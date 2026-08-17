import React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured, usernameEmail } from './lib/supabase';

const AppContext = createContext(null);

const demoProfile = {
  id: 'demo-admin',
  full_name: 'Cyprian Bwari',
  username: 'admin',
  role: 'super_admin',
  active: true
};

const demoProject = {
  id: 'demo-project',
  name: 'Heritage Housekeeping',
  company_id: 'demo-company',
  company_name: 'Heritage Legacy'
};

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(!supabaseConfigured);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      if (!supabaseConfigured) {
        if (mounted) {
          setDemoMode(true);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await hydrate();
      else setLoading(false);
    }
    boot();

    if (supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        if (nextSession) await hydrate();
        else {
          setProfile(null);
          setProjects([]);
          setProject(null);
          setLoading(false);
        }
      });
      return () => {
        mounted = false;
        listener.subscription.unsubscribe();
      };
    }
    return () => { mounted = false; };
  }, []);

  async function hydrate() {
    setLoading(true);
    try {
      const [{ data: p }, { data: ps }] = await Promise.all([
        supabase.rpc('my_profile').single(),
        supabase.rpc('my_projects')
      ]);
      if (p) setProfile(p);
      if (ps) {
        setProjects(ps);
        const stored = localStorage.getItem('stock_project_id');
        const selected = ps.find(x => x.id === stored) || ps[0];
        setProject(selected || null);
        if (selected) localStorage.setItem('stock_project_id', selected.id);
      }
    } finally {
      setLoading(false);
    }
    return p;
  }

  async function login(username, password, requestedRole) {
    if (demoMode) {
      setProfile({...demoProfile, role: requestedRole==='staff'?'staff':'super_admin'});
      setProjects([demoProject]);
      setProject(demoProject);
      return { error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameEmail(username),
      password
    });
    if (error) return { error };
    setSession(data.session);
    const hydratedProfile = await hydrate();
    const allowed = requestedRole === 'staff' ? hydratedProfile?.role === 'staff' : ['admin','super_admin'].includes(hydratedProfile?.role);
    if (!allowed) {
      await supabase.auth.signOut();
      return { error: new Error(`This account is registered as ${hydratedProfile?.role?.replace('_',' ')||'another role'}, not ${requestedRole}.`) };
    }
    return { error: null };
  }

  async function bootstrapSuperAdmin(fullName, username, password) {
    if (demoMode) {
      setProfile({...demoProfile, full_name: fullName, username});
      setProjects([demoProject]);
      setProject(demoProject);
      return { error: null };
    }
    const { data, error } = await supabase.auth.signUp({
      email: usernameEmail(username),
      password,
      options: { data: { full_name: fullName, username } }
    });
    if (error) return { error };
    if (!data.user) return { error: new Error('Unable to create the first account.') };
    const { error: setupError } = await supabase.rpc('bootstrap_super_admin', {
      p_user_id: data.user.id,
      p_full_name: fullName,
      p_username: username,
      p_company_name: 'Heritage Legacy',
      p_project_name: 'Main Project'
    });
    if (setupError) return { error: setupError };
    await hydrate();
    return { error: null };
  }

  async function logout() {
    if (demoMode) {
      setProfile(null); setProject(null); setProjects([]);
      return;
    }
    await supabase.auth.signOut();
  }

  function selectProject(next) {
    setProject(next);
    localStorage.setItem('stock_project_id', next.id);
  }

  const value = useMemo(() => ({
    session, profile, projects, project, loading, demoMode,
    login, logout, bootstrapSuperAdmin, selectProject, refresh: hydrate
  }), [session, profile, projects, project, loading, demoMode]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
