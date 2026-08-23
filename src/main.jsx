import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext';
import AppLayout from './layouts/AppLayout';
import AuthGate from './pages/AuthGate';
import Home from './pages/home/Home';
import Daily from './pages/usage/Daily';
import Weekly from './pages/usage/Weekly';
import Monthly from './pages/usage/Monthly';
import Trends from './pages/usage/Trends';
import Products from './pages/inventory/Products';
import Stock from './pages/inventory/Stock';
import Staff from './pages/staff/Staff';
import Assignments from './pages/staff/Assignments';
import Admin from './pages/admin/Admin';
import Audit from './pages/admin/Audit';
import Users from './pages/admin/Users';
import './styles/global.css';

function Protected({children,manager=false,superOnly=false}){
 const {profile,loading}=useApp();
 if(loading)return <div className="boot-screen"><div className="loader"></div><span>Loading Stock Control…</span></div>;
 if(!profile)return <AuthGate/>;
 if(manager&&!['admin','super_admin'].includes(profile.role))return <Navigate to="/" replace/>;
 if(superOnly&&profile.role!=='super_admin')return <Navigate to="/" replace/>;
 return children;
}

function App(){
 const {profile,loading}=useApp();
 if(loading)return <div className="boot-screen"><div className="loader"></div><span>Loading Stock Control…</span></div>;
 if(!profile)return <AuthGate/>;
 return <AppLayout/>;
}

function Router(){
 return <Routes>
   <Route element={<App/>}>
    <Route index element={<Home/>}/>
    <Route path="usage/daily" element={<Daily/>}/>
    <Route path="usage/weekly" element={<Protected manager><Weekly/></Protected>}/>
    <Route path="usage/monthly" element={<Protected manager><Monthly/></Protected>}/>
    <Route path="usage/trends" element={<Protected manager><Trends/></Protected>}/>
    <Route path="inventory/products" element={<Protected manager><Products/></Protected>}/>
    <Route path="inventory/stock" element={<Protected manager><Stock/></Protected>}/>
    <Route path="staff" element={<Protected manager><Staff/></Protected>}/>
    <Route path="staff/assignments" element={<Protected manager><Assignments/></Protected>}/>
    <Route path="admin" element={<Protected manager><Admin/></Protected>}/>
    <Route path="admin/audit" element={<Protected manager><Audit/></Protected>}/>
    <Route path="admin/staff" element={<Protected manager><Staff/></Protected>}/>
    <Route path="admin/users" element={<Protected superOnly><Users/></Protected>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
   </Route>
 </Routes>
}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><AppProvider><Router/></AppProvider></BrowserRouter></React.StrictMode>);
