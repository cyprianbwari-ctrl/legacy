import React from 'react';
import { useEffect,useState } from 'react';
import { ChevronLeft,ChevronRight } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import ConfirmButton from '../../components/ConfirmButton';
import { getStaff,assignStaff,getAssignment } from '../../services/api';
import { weekFor,shiftWeek,addDays,formatPeriod } from '../../lib/periods';

export default function Assignments(){
  const {project,profile}=useApp();
  const [period,setPeriod]=useState(weekFor(new Date()));
  const [staff,setStaff]=useState([]);
  const [assignments,setAssignments]=useState({});
  const [draft,setDraft]=useState({});
  async function load(){const s=await getStaff(project);setStaff(s);const a={};for(let i=0;i<6;i++){const d=addDays(period.start,i);const r=await getAssignment(project,d.toISOString().slice(0,10));if(r)a[d.toISOString().slice(0,10)]=r.staff_id;}setAssignments(a);setDraft(a)}
  useEffect(()=>{load()},[project?.id,period.key]);
  async function save(){for(const [date,staffId] of Object.entries(draft)){if(staffId)await assignStaff(project,date,staffId,profile.id)}await load()}
  return <div className="page">
    <PageHeader eyebrow="STAFF / ASSIGNMENTS" title="Assignments" description="Admin selects the expected staff member for each reporting day. Another active staff member may still submit if the day is not yet submitted." actions={<div className="period-nav"><button className="icon-btn" onClick={()=>setPeriod(shiftWeek(period,-1))}><ChevronLeft/></button><strong>{formatPeriod(period)}</strong><button className="icon-btn" onClick={()=>setPeriod(shiftWeek(period,1))}><ChevronRight/></button></div>}/>
    <section className="card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Day</th><th>Date</th><th>Assigned Staff</th></tr></thead><tbody>{[0,1,2,3,4,5].map(i=>{const d=addDays(period.start,i);const k=d.toISOString().slice(0,10);return <tr key={k}><td><strong>{d.toLocaleDateString('en-US',{weekday:'long'})}</strong></td><td>{d.toLocaleDateString()}</td><td><select value={draft[k]||''} onChange={e=>setDraft(x=>({...x,[k]:e.target.value}))}><option value="">Select staff</option>{staff.filter(s=>s.active&&s.role==='staff').map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></td></tr>})}</tbody></table></div><div className="card-footer"><ConfirmButton label="Confirm & Save Assignments" title="Confirm Weekly Assignments" message="These assignments are saved for the selected reporting week. They do not override the one-submission-per-day rule." onConfirm={save}/></div></section>
  </div>
}
