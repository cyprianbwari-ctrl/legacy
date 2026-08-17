import React from 'react';
import { useEffect,useMemo,useState } from 'react';
import { TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../../components/MetricCard';
import { getProducts,getWeeklyReportMatrix,getMonthlyReportMatrix } from '../../services/api';
import { weekFor,shiftWeek,formatNumber,monthLabel } from '../../lib/periods';
import { statusFor } from '../../lib/format';

export default function Trends(){
  const {project}=useApp();
  const [mode,setMode]=useState('weekly');
  const [anchor,setAnchor]=useState(new Date());
  const [products,setProducts]=useState([]);
  const [rows,setRows]=useState([]);
  const [productId,setProductId]=useState('all');
  useEffect(()=>{(async()=>{if(!project)return;const p=await getProducts(project);setProducts(p);if(mode==='weekly')setRows(await getWeeklyReportMatrix(project,weekFor(anchor),p));else setRows(await getMonthlyReportMatrix(project,new Date(anchor.getFullYear(),anchor.getMonth(),1),p));})()},[project?.id,mode,anchor]);
  const visible=productId==='all'?rows:rows.filter(r=>r.id===productId);
  const total=visible.reduce((s,r)=>s+Number(r.total||0),0);
  const top=[...rows].sort((a,b)=>Number(b.total||0)-Number(a.total||0))[0];
  const low=rows.filter(r=>statusFor(r.balance,r)==='low').length;
  const max=Math.max(...visible.map(r=>Number(r.total||0)),1);
  return <div className="page">
    <PageHeader eyebrow="USAGE / TRENDS" title="Trends" description="Management view for comparing consumption and stock pressure."/>
    <div className="filter-bar">
      <div className="segmented"><button className={mode==='weekly'?'active':''} onClick={()=>setMode('weekly')}>Weekly</button><button className={mode==='monthly'?'active':''} onClick={()=>setMode('monthly')}>Monthly</button></div>
      <button className="btn btn-secondary" onClick={()=>setAnchor(new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()-(mode==='weekly'?7:30)))}>Previous</button>
      <button className="btn btn-secondary" onClick={()=>setAnchor(new Date())}>Current</button>
      <button className="btn btn-secondary" onClick={()=>setAnchor(new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+(mode==='weekly'?7:30)))}>Next</button>
      <select value={productId} onChange={e=>setProductId(e.target.value)}><option value="all">All Products</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    </div>
    <section className="metric-grid three">
      <MetricCard label="Total Usage" value={formatNumber(total)} sub={mode==='weekly'?'Selected week':'Selected month'} icon={<TrendingUp size={18}/>}/>
      <MetricCard label="Top Product" value={top?.name||'—'} sub={top?`${formatNumber(top.total)} used`:''} icon={<Package size={18}/>}/>
      <MetricCard label="Low Stock" value={low} sub="Products below low-stock point" tone={low?'danger':'success'} icon={<AlertTriangle size={18}/>}/>
    </section>
    <section className="card chart-card">
      <div className="card-head"><div><h2>Consumption Overview</h2><p>{mode==='weekly'?`Week of ${weekFor(anchor).start.toLocaleDateString()}`:monthLabel(anchor)}</p></div></div>
      <div className="bar-chart">{visible.map(r=><div className="bar-item" key={r.id}><div className="bar-value">{formatNumber(r.total)}</div><div className="bar-track"><div className="bar-fill" style={{height:`${Math.max(3,(Number(r.total||0)/max)*100)}%`}}></div></div><div className="bar-label" title={r.name}>{r.name}</div></div>)}</div>
    </section>
    <section className="card"><div className="card-head"><div><h2>Product Comparison</h2><p>Usage totals for the selected period.</p></div></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>Initial</th><th>Total Usage</th><th>Balance</th><th>Trend</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}><td><strong>{r.name}</strong></td><td>{formatNumber(r.initial)}</td><td>{formatNumber(r.total)}</td><td>{formatNumber(r.balance)}</td><td>{r.total>r.initial*0.25?'High usage':'Moderate usage'}</td></tr>)}</tbody></table></div>
    </section>
  </div>
}
