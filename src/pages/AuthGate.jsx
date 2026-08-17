import React from 'react';
import { useState } from 'react';
import { ShieldCheck, Users, ArrowLeft, LockKeyhole, UserRound } from 'lucide-react';
import { useApp } from '../AppContext';
import Logo from '../components/Logo';

export default function AuthGate() {
  const { profile } = useApp();
  const [roleChoice,setRoleChoice]=useState(null);
  const [mode,setMode]=useState('login');
  const [form,setForm]=useState({name:'',username:'',password:'',confirm:''});
  const [error,setError]=useState('');
  const {login,bootstrapSuperAdmin}=useApp();

  async function submit(e){
    e.preventDefault(); setError('');
    try {
      if(mode==='setup'){
        if(form.password!==form.confirm) throw new Error('Passwords do not match.');
        const r=await bootstrapSuperAdmin(form.name,form.username,form.password);
        if(r.error) throw r.error;
        return;
      }
      const r=await login(form.username,form.password,roleChoice);
      if(r.error) throw r.error;
    } catch(err){ setError(err.message||'Unable to continue.'); }
  }

  if(profile) return null;

  if(!roleChoice) return <div className="auth-screen">
    <div className="auth-card role-card">
      <Logo/>
      <div className="auth-copy"><h1>Stock Control</h1><p>Select your access type before signing in.</p></div>
      <div className="role-grid">
        <button className="role-option" onClick={()=>setRoleChoice('admin')}><ShieldCheck/><strong>Admin</strong><span>Management, stock, reports and audit</span></button>
        <button className="role-option" onClick={()=>setRoleChoice('staff')}><Users/><strong>Staff</strong><span>Daily consumption submission</span></button>
      </div>
    </div>
  </div>;

  return <div className="auth-screen">
    <div className="auth-card">
      <button className="back-link" onClick={()=>{setRoleChoice(null);setError('')}}><ArrowLeft size={16}/> Change access type</button>
      <Logo/>
      <div className="auth-copy">
        <div className="access-chip">{roleChoice==='admin'?<ShieldCheck size={15}/>:<Users size={15}/>} {roleChoice==='admin'?'Admin Login':'Staff Login'}</div>
        <h1>Welcome back</h1>
        <p>Enter your account credentials to continue.</p>
      </div>
      {roleChoice==='admin' && <button className="setup-link" onClick={()=>setMode(mode==='setup'?'login':'setup')}>{mode==='setup'?'Back to login':'First-time Super Admin setup'}</button>}
      <form onSubmit={submit} className="form-stack">
        {mode==='setup' && <label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="Full name"/></label>}
        <label>Username<div className="input-icon"><UserRound size={16}/><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required autoComplete="username" placeholder="Username"/></div></label>
        <label>Password<div className="input-icon"><LockKeyhole size={16}/><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required autoComplete={mode==='setup'?'new-password':'current-password'} placeholder="Password"/></div></label>
        {mode==='setup' && <label>Confirm password<input type="password" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required autoComplete="new-password"/></label>}
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-lg" type="submit">{mode==='setup'?'Create Super Admin':'Sign In'}</button>
      </form>
      <p className="auth-note">Access is verified against your assigned account role. Selecting Admin does not grant Admin privileges.</p>
    </div>
  </div>;
}
