import React from 'react';
import { useEffect,useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ConfirmButton from '../../components/ConfirmButton';
import { getProducts,getStockAdjustments,addStockAdjustment,getCurrentBalances } from '../../services/api';
import { formatNumber } from '../../lib/periods';
import { statusFor,unitLabel } from '../../lib/format';

export default function Stock(){
  const {project,profile}=useApp();
  const [products,setProducts]=useState([]);
  const [adjustments,setAdjustments]=useState([]);
  const [balances,setBalances]=useState({});
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState(null);
  const [form,setForm]=useState({delta:0,reason:'Stock received',notes:''});
  async function load(){const p=await getProducts(project);setProducts(p);setAdjustments(await getStockAdjustments(project));setBalances(await getCurrentBalances(project,p))}
  useEffect(()=>{load()},[project?.id]);
  const filtered=products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  const current=(p)=>Number(balances[p.id] ?? p.full_stock ?? 0);
  async function save(){await addStockAdjustment(project,selected.id,form.delta,form.reason,form.notes,profile.id);setSelected(null);setForm({delta:0,reason:'Stock received',notes:''});await load();}
  return <div className="page">
    <PageHeader eyebrow="INVENTORY / STOCK" title="Stock" description="Monitor balances and record controlled stock adjustments."/>
    <section className="card"><div className="toolbar"><div className="search-box"><Search size={16}/><input placeholder="Search stock..." value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="muted"><SlidersHorizontal size={15}/> Thresholds set in Products</span></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>Unit</th><th>Full Stock</th><th>Current Balance</th><th>Order Point</th><th>Low Stock</th><th>Status</th><th></th></tr></thead>
      <tbody>{filtered.map(p=>{const balance=current(p);const st=statusFor(balance,p);return <tr key={p.id}><td><strong>{p.name}</strong></td><td>{unitLabel(p.unit)}</td><td>{formatNumber(p.full_stock)}</td><td className={st==='low'?'balance-danger':st==='order'?'balance-warning':''}><strong>{formatNumber(balance)}</strong></td><td>{formatNumber(p.order_point)}</td><td>{formatNumber(p.low_stock_point)}</td><td><StatusBadge status={st}>{st==='low'?'LOW STOCK':st==='order'?'ORDER POINT':'NORMAL'}</StatusBadge></td><td><button className="btn btn-small btn-secondary" onClick={()=>setSelected(p)}>Adjust</button></td></tr>})}</tbody></table></div>
    </section>
    <section className="card"><div className="card-head"><div><h2>Recent Adjustments</h2><p>Every adjustment is retained for audit.</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Product</th><th>Change</th><th>Reason</th><th>By</th></tr></thead><tbody>{adjustments.slice(0,20).map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.products?.name}</td><td>{a.quantity_delta>0?'+':''}{a.quantity_delta}</td><td>{a.reason}</td><td>{a.profiles?.full_name}</td></tr>)}</tbody></table></div></section>
    <Modal open={Boolean(selected)} title="Stock Adjustment" onClose={()=>setSelected(null)} footer={<><button className="btn btn-secondary" onClick={()=>setSelected(null)}>Cancel</button><ConfirmButton label="Confirm & Save" title="Confirm Stock Adjustment" message={`This will adjust ${selected?.name||'the selected product'} and create an audit record.`} onConfirm={save}/></>}>
      <div className="adjustment-current"><span>Current balance</span><strong>{selected?formatNumber(balances[selected.id] ?? selected.full_stock):'0'} {selected&&unitLabel(selected.unit)}</strong></div>
      <div className="form-grid"><label>Adjustment (+ / -)<input type="number" step="0.001" value={form.delta} onChange={e=>setForm({...form,delta:Number(e.target.value)})}/></label><label>Reason<select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}>{['Stock received','Damaged','Spoilage','Correction','Physical count','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label className="full">Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div>
    </Modal>
  </div>
}
