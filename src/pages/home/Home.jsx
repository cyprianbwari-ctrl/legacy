import React from 'react';
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, PackageOpen } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../../components/MetricCard';
import StatusBadge from '../../components/StatusBadge';
import { getProducts, getReportsInRange, demoWeeklyUsage, getMonthlyReportMatrix, getMySubmissionStatus } from '../../services/api';
import { weekFor, formatNumber, formatPeriod } from '../../lib/periods';
import { statusFor } from '../../lib/format';

export default function Home(){
  const {project,profile}=useApp();
  const [products,setProducts]=useState([]);
  const [reports,setReports]=useState([]);
  const [monthlyRows,setMonthlyRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const week=weekFor(new Date());
  const staff=profile?.role==='staff';
  const [staffStatus,setStaffStatus]=useState({submitted:false});

  useEffect(()=>{(async()=>{setLoading(true);try{const p=await getProducts(project);setProducts(p);if(staff){if(project?.id!=='demo-project')setStaffStatus(await getMySubmissionStatus(project,new Date().toISOString().slice(0,10)));}else if(project?.id!=='demo-project'){setReports(await getReportsInRange(project,week.start,week.end));setMonthlyRows(await getMonthlyReportMatrix(project,new Date(),p));}else{setMonthlyRows(demoWeeklyUsage(p,week));}}finally{setLoading(false)}})()},[project?.id,staff]);

  if(staff) return <div className="page">
    <PageHeader eyebrow="HOME" title={`Good morning, ${profile?.full_name?.split(' ')[0]||'Staff'}`} description="Your daily consumption task is ready."/>
    <section className="card staff-home-card">
      <div className="staff-home-icon"><CheckCircle2 size={24}/></div>
      <div><div className="eyebrow">TODAY'S REPORT</div><h2>{staffStatus.submitted?'Report already submitted':'Daily report awaiting submission'}</h2><p>{staffStatus.submitted?'Your submission is locked. Staff cannot view or edit it after submission.':'Enter today’s usage from the Daily Consumption Checklist. Zero is a valid entry.'}</p></div>
      {!staffStatus.submitted && <a className="btn btn-primary btn-lg" href="/usage/daily">Start Daily Report <ArrowRight size={17}/></a>}
      {staffStatus.submitted && <StatusBadge status="submitted">SUBMITTED</StatusBadge>}
    </section>
  </div>;

  const rows=project?.id==='demo-project'?demoWeeklyUsage(products,week):products.map(p=>({...p,initial:p.full_stock,total:0,balance:p.full_stock,daily:[]}));
  const low=rows.filter(r=>statusFor(r.balance,r)==='low');
  const order=rows.filter(r=>statusFor(r.balance,r)==='order');
  const todayKey=new Date().toISOString().slice(0,10);
  const todayReport=reports.find(r=>r.report_date===todayKey);

  return <div className="page">
    <PageHeader eyebrow="HOME" title={`Good morning, ${profile?.full_name?.split(' ')[0]||'Admin'}`} description="Here's what's happening today." />
    <section className="metric-grid three">
      <MetricCard label="Today's Report" value={todayReport||project?.id==='demo-project'?'✓ SUBMITTED':'NOT SUBMITTED'} sub={todayReport?'Submitted':'Report status'} tone={todayReport?'success':'warning'} icon={todayReport?<CheckCircle2 size={18}/>:<AlertTriangle size={18}/>} />
      <MetricCard label="This Week" value={formatNumber(rows.reduce((s,r)=>s+(r.total||0),0))} sub="Total usage" />
      <MetricCard label="This Month" value={formatNumber(monthlyRows.reduce((s,r)=>s+(r.total||0),0))} sub="Usage summary" />
    </section>

    <section className="split-grid">
      <div className="card attention-card">
        <div className="card-head"><div><h2>Stock Attention</h2><p>Products approaching or below their Admin thresholds.</p></div><PackageOpen size={20}/></div>
        <div className="attention-summary">
          <div className="attention-count danger"><span>●</span><strong>{low.length}</strong><small>Low Stock</small></div>
          <div className="attention-count warning"><span>●</span><strong>{order.length}</strong><small>Order Point</small></div>
        </div>
        <a className="text-link" href="/inventory/stock">View Inventory <ArrowRight size={15}/></a>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Today's Report</h2><p>Submission status for the current reporting day.</p></div></div>
        {todayReport ? <div className="report-status"><StatusBadge status="submitted">Submitted</StatusBadge><div><strong>{todayReport.profiles?.full_name||'Staff member'}</strong><span>Report received</span></div></div> :
          <div className="report-status"><StatusBadge status="pending">Not submitted</StatusBadge><div><strong>Waiting for submission</strong><span>Admin can monitor the Daily page.</span></div></div>}
      </div>
    </section>

    <section className="card">
      <div className="card-head"><div><h2>Attention</h2><p>{formatPeriod(week)} · Saturday–Thursday</p></div><span className="muted">Friday excluded</span></div>
      <div className="attention-list">
        {loading ? <div className="loading-row">Loading stock…</div> : rows.filter(r=>statusFor(r.balance,r)!=='normal').slice(0,6).map(r=>{
          const st=statusFor(r.balance,r);
          return <div className="attention-row" key={r.id}>
            <div className={`attention-dot ${st}`}></div><strong>{r.name}</strong><span className="row-spacer"></span><span>Balance <b>{formatNumber(r.balance)}</b></span><span>{st==='low'?'Low Stock':'Order Point'}: {formatNumber(st==='low'?r.low_stock_point:r.order_point)}</span><StatusBadge status={st}>{st==='low'?'LOW STOCK':'ORDER POINT'}</StatusBadge>
          </div>
        })}
        {!loading && !rows.some(r=>statusFor(r.balance,r)!=='normal') && <div className="healthy-state"><CheckCircle2 size={20}/><span>All active products are above their thresholds.</span></div>}
      </div>
    </section>
  </div>
}
