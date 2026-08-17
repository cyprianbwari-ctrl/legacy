import React from 'react';
import { useEffect,useState } from 'react';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ConfirmButton from '../../components/ConfirmButton';
import { getStaff } from '../../services/api';
import { supabase,supabaseConfigured } from '../../lib/supabase';

export default function Staff(){
  const {project,profile}=useApp();
  const [staff,setStaff]=useState([]);
  const [search,setSearch]=useState('');
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({full_name:'',username:'',password:''});
  const [menu,setMenu]=useState(null);
  const [error,setError]=useState('');
  async function load(){setStaff(await getStaff(project))}
  useEffect(()=>{load()},[project?.id]);
  async function createStaff(){
    if(!supabaseConfigured) { setStaff(s=>[...s,{id:crypto.randomUUID(),...form,role:'staff',active:true}]);setOpen(false);return; }
    const {data:{session}}=await supabase.auth.getSession();
    const res=await supabase.functions.invoke('create-user',{body:{full_name:form.full_name,username:form.username,password:form.password,role:'staff',project_id:project.id}});
    if(res.error) throw res.error;
    setOpen(false);setForm({full_name:'',username:'',password:''});await load();
  }
  async function deactivate(id){
    if(!supabaseConfigured){setStaff(s=>s.map(x=>x.id===id?{...x,active:false}:x));return;}
    const {error}=await supabase.from('profiles').update({active:false}).eq('id',id);
    if(error)throw error;
    await supabase.from('project_memberships').delete().eq('project_id',project.id).eq('user_id',id);
    await load();
  }
  const filtered=staff.filter(x=>x.full_name.toLowerCase().includes(search.toLowerCase())||x.username.toLowerCase().includes(search.toLowerCase()));
  return <div className="page">
    <PageHeader eyebrow="STAFF" title="Staff" description="Manage staff accounts. Deactivation is reversible through Admin." actions={<button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={17}/>Add Staff</button>}/>
    {error&&<div className="form-error">{error}</div>}
    <section className="card"><div className="toolbar"><div className="search-box"><Search size={16}/><input placeholder="Search staff..." value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="muted">{filtered.length} people</span></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map(s=><tr key={s.id}><td><strong>{s.full_name}</strong></td><td>{s.username}</td><td>{s.role}</td><td>{s.active?<StatusBadge status="normal">ACTIVE</StatusBadge>:<StatusBadge status="pending">INACTIVE</StatusBadge>}</td><td className="action-cell"><button className="icon-btn" onClick={()=>setMenu(menu===s.id?null:s.id)}><MoreHorizontal size={18}/></button>{menu===s.id&&<div className="action-menu"><button onClick={()=>{setForm({full_name:s.full_name,username:s.username,password:''});setOpen(true);setMenu(null)}}>View / edit</button>{s.active&&<ConfirmButton label="Deactivate" className="menu-danger" title="Deactivate Staff" message="This keeps the account history but removes active access to the project." onConfirm={()=>deactivate(s.id)}/>}</div>}</td></tr>)}</tbody></table></div>
    </section>
    <Modal open={open} title="Add Staff" onClose={()=>setOpen(false)} footer={<><button className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><ConfirmButton label="Confirm & Create" title="Create Staff Account" message="The new staff member will be able to sign in as Staff only." onConfirm={createStaff}/></>}>
      <div className="form-grid"><label className="full">Full name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label><label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label></div>
    </Modal>
  </div>
}
