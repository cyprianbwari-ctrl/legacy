import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Send } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import ConfirmButton from '../../components/ConfirmButton';
import { getProducts,getReport,submitDaily,updateDaily,getMySubmissionStatus } from '../../services/api';
import { unitLabel } from '../../lib/format';
import { formatNumber } from '../../lib/periods';

export default function Daily(){
  const {project,profile}=useApp();
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [products,setProducts]=useState([]);
  const [report,setReport]=useState(null);
  const [values,setValues]=useState({});
  const [error,setError]=useState('');
  const manager=['admin','super_admin'].includes(profile?.role);
  const isFriday=new Date(`${date}T12:00:00`).getDay()===5;

  async function load(){
    if(!project) return;
    const p=await getProducts(project);setProducts(p);
    if(project.id==='demo-project'){setReport(null);setValues(Object.fromEntries(p.map(x=>[x.id,0])));return;}
    if(manager){
      const r=await getReport(project,date);setReport(r);
      setValues(Object.fromEntries((r?.daily_usage||[]).map(x=>[x.product_id,x.quantity])));
    } else {
      const status=await getMySubmissionStatus(project,date);
      setReport(status.submitted ? {submitted_at:status.submitted_at} : null);
      setValues(Object.fromEntries(p.map(x=>[x.id,0])));
    }
  }
  useEffect(()=>{load().catch(e=>setError(e.message))},[project?.id,date]);

  async function submit(){
    setError('');
    const rows=products.map(p=>({product_id:p.id,quantity:Number(values[p.id]||0)}));
    const r=await submitDaily(project,date,profile.id,rows);
    setReport(r); await load();
  }

  async function saveEdit(){
    const rows=products.map(p=>({product_id:p.id,quantity:Number(values[p.id]||0)}));
    await updateDaily(project,report.id,profile.id,rows);
    await load();
  }

  const submitted=Boolean(report);
  return <div className="page">
    <PageHeader eyebrow="USAGE / DAILY" title="Daily Consumption Checklist" description="One report for the whole product list. Zero is a valid entry." actions={
      <div className="date-control"><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
    }/>
    {isFriday && <div className="notice warning"><Lock size={17}/><div><strong>Friday is an off day.</strong><span>No consumption report is accepted or displayed for Friday.</span></div></div>}
    {!isFriday && <section className="card">
      <div className="report-toolbar"><div><span className="eyebrow">REPORT DATE</span><h2>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</h2></div>{submitted?<StatusBadge status="submitted">Submitted</StatusBadge>:<StatusBadge status="pending">Not submitted</StatusBadge>}</div>
      {submitted && !manager ? <div className="locked-report"><CheckCircle2 size={24}/><h3>Report submitted</h3><p>This report is locked. Staff cannot view or edit a submitted report.</p><small>Submitted by {report.profiles?.full_name||'staff'}.</small></div> :
      <form onSubmit={e=>{e.preventDefault();if(!submitted)submit().catch(e=>setError(e.message))}}>
        <div className="table-wrap">
          <table className="data-table consumption-table"><thead><tr><th>Housekeeping Supplies</th><th>Unit</th><th>Today's Usage</th></tr></thead>
          <tbody>{products.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{unitLabel(p.unit)}</td><td><input className="qty-input" type="number" min="0" step="0.001" value={values[p.id]??0} onChange={e=>setValues(v=>({...v,[p.id]:e.target.value}))} /></td></tr>)}</tbody></table>
        </div>
        {error&&<div className="form-error">{error}</div>}
        {!manager && !submitted && <button className="btn btn-primary btn-lg submit-btn" type="submit"><Send size={17}/> Submit Report</button>}
        {manager && submitted && <ConfirmButton label="Confirm & Save" title="Confirm Daily Report Changes" message="This will replace the submitted quantities for this day and create an audit record." onConfirm={()=>saveEdit()} />}
      </form>}
    </section>}
  </div>
}
