import React from 'react';
import { useEffect,useState } from 'react';
import { Download,Search } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import { getAudit } from '../../services/api';
import { downloadCsv } from '../../lib/csv';

export default function Audit(){
 const {project}=useApp(); const [rows,setRows]=useState([]);const [search,setSearch]=useState('');
 useEffect(()=>{getAudit(project).then(setRows).catch(()=>setRows([]))},[project?.id]);
 const filtered=rows.filter(r=>`${r.action} ${r.entity_type} ${r.profiles?.full_name||''}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="page">
  <PageHeader eyebrow="ADMIN / AUDIT" title="Audit Trail" description="Permanent operational history for management actions and report changes." actions={<button className="btn btn-secondary" onClick={()=>downloadCsv('audit.csv',filtered.map(r=>({date:r.created_at,actor:r.profiles?.full_name,action:r.action,entity:r.entity_type,details:JSON.stringify(r.details)})))}><Download size={16}/>Export</button>}/>
  <section className="card"><div className="toolbar"><div className="search-box"><Search size={16}/><input placeholder="Search audit..." value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="muted">{filtered.length} records</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Date / Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.profiles?.full_name||'System'}</td><td><strong>{r.action}</strong></td><td>{r.entity_type}</td><td><code>{JSON.stringify(r.details)}</code></td></tr>)}</tbody></table></div></section>
 </div>
}
