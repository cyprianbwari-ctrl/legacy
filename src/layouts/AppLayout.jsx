import React from 'react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, BarChart3, Boxes, Users, Settings, ChevronDown, ChevronRight, LogOut, Menu, X, ClipboardList, Package, LineChart, CalendarDays, ShieldCheck, FileText, UserCog } from 'lucide-react';
import { useApp } from '../AppContext';
import Logo from '../components/Logo';

function NavItem({to,icon:Icon,label,onClick}) {
  return <NavLink end={to==='/' } to={to} onClick={onClick} className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={18}/><span>{label}</span></NavLink>;
}

export default function AppLayout() {
  const {profile,project,projects,selectProject,logout}=useApp();
  const [mobile,setMobile]=useState(false);
  const [usageOpen,setUsageOpen]=useState(true);
  const [inventoryOpen,setInventoryOpen]=useState(true);
  const [staffOpen,setStaffOpen]=useState(true);
  const [adminOpen,setAdminOpen]=useState(true);
  const location=useLocation();

  const closeMobile=()=>setMobile(false);
  const manager=profile?.role==='admin'||profile?.role==='super_admin';

  return <div className="app-shell">
    <aside className={`sidebar ${mobile?'mobile-open':''}`}>
      <div className="sidebar-top">
        <Logo/>
        <button className="mobile-close icon-btn" onClick={()=>setMobile(false)}><X/></button>
      </div>

      {projects?.length>1 && <div className="project-switcher">
        <label>PROJECT</label>
        <select value={project?.id||''} onChange={e=>selectProject(projects.find(p=>p.id===e.target.value))}>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>}

      <nav className="nav">
        <NavItem to="/" icon={Home} label="Home" onClick={closeMobile}/>

        <div className="nav-group">
          <button className={`nav-item nav-parent ${location.pathname.startsWith('/usage')?'group-active':''}`} onClick={()=>setUsageOpen(!usageOpen)}>
            <BarChart3 size={18}/><span>Usage</span>{usageOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
          </button>
          {usageOpen && <div className="nav-sub">
            <NavLink to="/usage/daily" onClick={closeMobile}>Daily</NavLink>
            <NavLink to="/usage/weekly" onClick={closeMobile}>Weekly</NavLink>
            <NavLink to="/usage/monthly" onClick={closeMobile}>Monthly</NavLink>
            {manager && <NavLink to="/usage/trends" onClick={closeMobile}>Trends</NavLink>}
          </div>}
        </div>

        {manager && <div className="nav-group">
          <button className={`nav-item nav-parent ${location.pathname.startsWith('/inventory')?'group-active':''}`} onClick={()=>setInventoryOpen(!inventoryOpen)}>
            <Boxes size={18}/><span>Inventory</span>{inventoryOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
          </button>
          {inventoryOpen && <div className="nav-sub">
            <NavLink to="/inventory/products" onClick={closeMobile}><Package size={15}/>Products</NavLink>
            <NavLink to="/inventory/stock" onClick={closeMobile}><Boxes size={15}/>Stock</NavLink>
          </div>}
        </div>}

        {manager && <div className="nav-group">
          <button className={`nav-item nav-parent ${location.pathname.startsWith('/staff')?'group-active':''}`} onClick={()=>setStaffOpen(!staffOpen)}>
            <Users size={18}/><span>Staff</span>{staffOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
          </button>
          {staffOpen && <div className="nav-sub">
            <NavLink to="/staff" onClick={closeMobile}>Staff</NavLink>
            <NavLink to="/staff/assignments" onClick={closeMobile}><CalendarDays size={15}/>Assignments</NavLink>
          </div>}
        </div>}

        {manager && <div className="nav-group">
          <button className={`nav-item nav-parent ${location.pathname.startsWith('/admin')?'group-active':''}`} onClick={()=>setAdminOpen(!adminOpen)}>
            <Settings size={18}/><span>Admin</span>{adminOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
          </button>
          {adminOpen && <div className="nav-sub">
            <NavLink to="/admin" onClick={closeMobile}><ShieldCheck size={15}/>Overview</NavLink>
            <NavLink to="/admin/audit" onClick={closeMobile}><FileText size={15}/>Audit</NavLink>
            {profile?.role==='super_admin' && <NavLink to="/admin/users" onClick={closeMobile}><UserCog size={15}/>Users</NavLink>}
          </div>}
        </div>}
      </nav>

      <div className="sidebar-user">
        <div className="avatar">{(profile?.full_name||'U').slice(0,1).toUpperCase()}</div>
        <div className="sidebar-user-text"><strong>{profile?.full_name||'User'}</strong><span>{profile?.role?.replace('_',' ')}</span></div>
        <button className="icon-btn ghost" title="Sign out" onClick={logout}><LogOut size={17}/></button>
      </div>
    </aside>

    <main className="main-shell">
      <div className="mobile-header">
        <button className="icon-btn" onClick={()=>setMobile(true)}><Menu/></button>
        <Logo compact/>
        <div className="mobile-user">{profile?.full_name}</div>
      </div>
      <Outlet/>
    </main>
  </div>
}
