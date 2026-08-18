import React from 'react';
import { useEffect,useState } from 'react';
import { ChevronLeft,ChevronRight } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import { downloadCsv } from '../../lib/csv';
import StatusBadge from '../../components/StatusBadge';
import ConfirmButton from '../../components/ConfirmButton';
import { getProducts,getMonthlyReportMatrix,saveMonthlyMatrix } from '../../services/api';
import { formatNumber,monthLabel } from '../../lib/periods';
import { statusFor,unitLabel,formatQuantity } from '../../lib/format';

export default function Monthly(){
  const {project,profile}=useApp();
  const manager=['admin','super_admin'].includes(profile?.role);
  const now=new Date();
  const [month,setMonth]=useState(new Date(now.getFullYear(),now.getMonth(),1));
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  async function load(){if(!project)return;setLoading(true);try{const p=await getProducts(project);setRows(await getMonthlyReportMatrix(project,month,p))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[project?.id,month.getFullYear(),month.getMonth()]);
  function move(n){setMonth(new Date(month.getFullYear(),month.getMonth()+n,1))}
  async function save(){await saveMonthlyMatrix(project,month,rows,profile.id);await load();}
  return <div className="page">
    <PageHeader eyebrow="USAGE / MONTHLY" title="Monthly Usage" description="Four reporting weeks. Friday is excluded from the report." actions={<><button className="btn btn-secondary" onClick={()=>downloadCsv(`monthly-${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}.csv`,rows.map(r=>({product:r.name,unit:r.unit,initial:r.initial,week_1:r.weekTotals[0],week_2:r.weekTotals[1],week_3:r.weekTotals[2],week_4:r.weekTotals[3],total_usage:r.total,balance:r.balance})))}>Export</button><div className="period-nav"><button className="icon-btn" onClick={()=>move(-1)}><ChevronLeft/></button><strong>{monthLabel(month)}</strong><button className="icon-btn" onClick={()=>move(1)}><ChevronRight/></button></div></>}/>
    {error&&<div className="form-error">{error}</div>}
    <section className="card table-card">
      <div className="card-head"><div><h2>{monthLabel(month)}</h2><p>Weekly totals roll into the monthly total and balance.</p></div>{manager&&<ConfirmButton label="Confirm & Save" title="Confirm Monthly Changes" message="You are changing the monthly initial quantities. This will affect the monthly balance." onConfirm={save}/>}</div>
      <div className="table-wrap"><table className="data-table monthly-table"><thead><tr><th>Product</th><th>Unit</th><th>Initial</th>{[1,2,3,4].map(x=><th key={x}>Week {x}</th>)}<th>Total Usage</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>{loading?<tr><td colSpan="11" className="loading-row">Loading…</td></tr>:rows.map(r=>{const st=statusFor(r.balance,r);return <tr key={r.id}><td><strong>{r.name}</strong></td><td>{unitLabel(r.unit)}</td><td>{manager?<input className="qty-input compact" type="number" min="0" step="0.001" value={r.initial} onChange={e=>setRows(rs=>rs.map(x=>x.id===r.id?{...x,initial:Number(e.target.value)}:x))}/>:formatQuantity(r.initial, r)}</td>{[0,1,2,3].map(i=><td key={i}>{manager?<input className="qty-input compact" type="number" min="0" step="0.001" value={r.weekTotals[i]||0} onChange={e=>setRows(rs=>rs.map(x=>x.id===r.id?(()=>{const w=[...x.weekTotals];w[i]=Number(e.target.value);const total=w.reduce((a,b)=>a+b,0);return {...x,weekTotals:w,total,balance:x.initial-total}})():x))}/>:formatNumber(r.weekTotals[i]||0)}</td>)}<td><strong>{formatQuantity(r.total, r)}</strong></td><td className={st==='low'?'balance-danger':st==='order'?'balance-warning':''}><strong>{formatQuantity(r.balance, r)}</strong></td><td><StatusBadge status={st}>{st==='low'?'LOW STOCK':st==='order'?'ORDER POINT':'NORMAL'}</StatusBadge></td></tr>})}</tbody></table></div>
    </section>
    <div className="bottom-period-nav"><button className="btn btn-secondary" onClick={()=>move(-1)}>Previous Month</button><button className="btn btn-primary" onClick={()=>setMonth(new Date())}>Current Month</button><button className="btn btn-secondary" onClick={()=>move(1)}>Next Month</button></div>
  </div>
}
