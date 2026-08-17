import React from 'react';
import { useEffect,useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ConfirmButton from '../../components/ConfirmButton';
import { supabase,supabaseConfigured } from '../../lib/supabase';
import { getStaff } from '../../services/api';

export default function Users(){
 const {project,profile}=useApp();const [users,setUsers]=useState([]);const [open,setOpen]=useState(false);const [form,setForm]=useState({full_name:'',username:'',password:'',role:'admin'});const [error,setError]=useState('');
 async function load(){setUsers(await getStaff(project))}
 useEffect(()=>{load()},[project?.id]);
 async function create(){if(!supabaseConfigured){setOpen(false);return;}const r=await supabase.functions.invoke('create-user',{body:{...form,project_id:project.id}});if(r.error)throw r.error;setOpen(false);setForm({full_name:'',username:'',password:'',role:'admin'});await load();}
 return <div className="page"><PageHeader eyebrow="ADMIN / USERS" title="Admin Users" description="Super Admin can create additional management accounts." actions={<button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={17}/>Add Admin</button>}/><section className="card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.filter(u=>u.role!=='staff').map(u=><tr key={u.id}><td><strong>{u.full_name}</strong></td><td>{u.username}</td><td>{u.role}</td><td>{u.active?<StatusBadge status="normal">ACTIVE</StatusBadge>:<StatusBadge status="pending">INACTIVE</StatusBadge>}</td></tr>)}</tbody></table></div></section>
 <Modal open={open} title="Add Admin" onClose={()=>setOpen(false)} footer={<><button className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><ConfirmButton label="Confirm & Create" title="Create Admin Account" message="This creates a management account. Only Super Admin can create Admin accounts." onConfirm={create}/></>}><div className="form-grid"><label className="full">Full name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label><label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label></div>{error&&<div className="form-error">{error}</div>}</Modal>
 </div>
}
