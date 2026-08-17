import React from 'react';
import { useState } from 'react';
import { ShieldCheck,Database,FileText,Users,Plus } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../../components/MetricCard';
import Modal from '../../components/Modal';
import ConfirmButton from '../../components/ConfirmButton';
import { supabase,supabaseConfigured } from '../../lib/supabase';

export default function Admin(){
 const {profile,project,refresh}=useApp();
 const [open,setOpen]=useState(false); const [name,setName]=useState('');
 async function create(){if(!supabaseConfigured)return;const {error}=await supabase.rpc('create_project',{p_company_id:project.company_id,p_name:name});if(error)throw error;setName('');setOpen(false);await refresh();}
 return <div className="page">
  <PageHeader eyebrow="ADMIN" title="Administration" description="Control accounts, records, imports and audit visibility." actions={<button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={17}/>New Project</button>}/>
  <section className="metric-grid three">
   <MetricCard label="Access Role" value={profile?.role?.replace('_',' ')} sub="Current signed-in account" icon={<ShieldCheck size={18}/>}/>
   <MetricCard label="Project" value={project?.name||'—'} sub={project?.company_name||''} icon={<Database size={18}/>}/>
   <MetricCard label="Audit" value="Enabled" sub="Changes are retained" icon={<FileText size={18}/>} tone="success"/>
  </section>
  <section className="card quick-admin"><div className="card-head"><div><h2>Administration Controls</h2><p>Keep management actions in their dedicated areas.</p></div></div><div className="admin-links">
   <a href="/inventory/products"><Database size={18}/><div><strong>Products & Import</strong><span>Add, edit, deactivate and import products.</span></div></a>
   <a href="/staff"><Users size={18}/><div><strong>Staff Accounts</strong><span>Add and deactivate staff accounts.</span></div></a>
   <a href="/admin/audit"><FileText size={18}/><div><strong>Audit Trail</strong><span>Review who changed what and when.</span></div></a>
  </div></section>
  <Modal open={open} title="Create Project" onClose={()=>setOpen(false)} footer={<><button className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><ConfirmButton label="Confirm & Create" title="Create Project" message="The project will be created under the current company and this account will be added to it." onConfirm={create}/></>}><label className="form-stack">Project name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Project name"/></label></Modal>
 </div>
}
