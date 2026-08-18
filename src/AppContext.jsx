import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigured, usernameEmail } from './lib/supabase';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState('');

  const hydrationRef = useRef(0);

  async function hydrate(activeSession = null) {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return null;
    }

    const hydrationId = ++hydrationRef.current;
    setLoading(true);
    setError('');

    try {
      const sessionResult = activeSession
        ? { data: { session: activeSession } }
        : await supabase.auth.getSession();

      const nextSession = sessionResult.data?.session || null;
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setProjects([]);
        setProject(null);
        setSetupRequired(false);
        return null;
      }

      let { data: profileData, error: profileError } =
        await supabase.rpc('my_profile').maybeSingle();

      // V5 fallback: if the RPC is unavailable/mis-granted, read only the
      // currently authenticated profile. The RLS policy permits auth.uid().
      if (profileError) {
        const fallback = await supabase
          .from('profiles')
          .select('id,full_name,username,role,active')
          .eq('id', nextSession.user.id)
          .maybeSingle();
        profileData = fallback.data;
        profileError = fallback.error;
      }

      if (profileError) throw profileError;

      // Load the authenticated profile first. A project-list failure must never
      // destroy an otherwise valid signed-in session and send the user back to
      // the login screen.
      if (hydrationId !== hydrationRef.current) return profileData || null;
      setProfile(profileData || null);

      if (!profileData) {
        setSetupRequired(true);
        setProject(null);
        return null;
      }

      setSetupRequired(false);

      let { data: projectData, error: projectError } =
        await supabase.rpc('my_projects');

      // V5 fallback: recover the projects through the user's membership if
      // the helper RPC is unavailable or its execute grant is missing.
      if (projectError) {
        const fallback = await supabase
          .from('project_memberships')
          .select('project_id, projects(id,name,company_id,companies(name))')
          .eq('user_id', nextSession.user.id)
          .eq('active', true);

        if (!fallback.error) {
          projectData = (fallback.data || []).map((row) => ({
            id: row.projects?.id || row.project_id,
            name: row.projects?.name || 'Project',
            company_id: row.projects?.company_id || null,
            company_name: row.projects?.companies?.name || ''
          })).filter((row) => row.id);
          projectError = null;
        }
      }

      if (projectError) {
        // Keep the authenticated profile alive. This gives the UI a useful
        // error instead of bouncing a valid user back to authentication.
        if (hydrationId === hydrationRef.current) {
          setProjects([]);
          setProject(null);
          setError(`Signed in, but your project could not be loaded: ${projectError.message}`);
        }
        return profileData;
      }

      if (hydrationId !== hydrationRef.current) return profileData;

      setProjects(projectData || []);

      const storedProjectId = localStorage.getItem('stock_project_id');
      const selected = (projectData || []).find((item) => item.id === storedProjectId)
        || (projectData || [])[0]
        || null;

      setProject(selected);

      if (selected) {
        localStorage.setItem('stock_project_id', selected.id);
      } else {
        localStorage.removeItem('stock_project_id');
      }

      return profileData;
    } catch (e) {
      if (hydrationId === hydrationRef.current) {
        setError(e.message || 'Unable to load your account.');
        // Do not erase a valid profile because a secondary bootstrap request
        // failed. Only an explicit signed-out event clears authentication.
      }
      return null;
    } finally {
      if (hydrationId === hydrationRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return undefined;
    }

    let alive = true;

    hydrate().catch(() => {});

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;

      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setProjects([]);
        setProject(null);
        setSetupRequired(false);
        setLoading(false);
        return;
      }

      // The login() function performs the bootstrap itself. Do not run a
      // second competing hydrate here; doing so can race the first request and
      // incorrectly clear the profile immediately after a successful login.
      if (event === 'INITIAL_SESSION') {
        setTimeout(() => {
          if (alive) hydrate(nextSession).catch(() => {});
        }, 0);
      }
    });

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function login(identifier, password, requestedRole) {
    if (!supabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.') };
    }

    const email = usernameEmail(identifier);

    let result = await supabase.auth.signInWithPassword({ email, password });

    // Helpful fallback for an Auth user that was manually created with a real email.
    if (result.error && String(identifier).includes('@') && identifier.trim().toLowerCase() !== email) {
      result = await supabase.auth.signInWithPassword({
        email: identifier.trim().toLowerCase(),
        password
      });
    }

    if (result.error) return { error: result.error };

    const hydratedProfile = await hydrate(result.data.session);

    if (!hydratedProfile) {
      setSetupRequired(true);
      return { error: null, needsSetup: true };
    }

    const requestedIsManager = requestedRole === 'admin';
    const actualIsManager = ['admin', 'super_admin'].includes(hydratedProfile.role);

    if ((requestedIsManager && !actualIsManager) || (!requestedIsManager && hydratedProfile.role !== 'staff')) {
      await supabase.auth.signOut();
      return {
        error: new Error(
          `This account is registered as ${hydratedProfile.role.replace('_', ' ')}, not ${requestedRole}.`
        )
      };
    }

    return { error: null };
  }

  async function completeSuperAdminSetup(fullName, username, companyName, projectName) {
    if (!supabaseConfigured || !supabase) {
      return { error: new Error('Supabase is not configured.') };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const currentSession = sessionData?.session;

    if (!currentSession?.user) {
      return { error: new Error('Sign in to the Auth account first, then complete Super Admin setup.') };
    }

    const { error: rpcError } = await supabase.rpc('complete_first_super_admin', {
      p_full_name: fullName,
      p_username: username,
      p_company_name: companyName,
      p_project_name: projectName
    });

    if (rpcError) return { error: rpcError };

    await hydrate(currentSession);
    return { error: null };
  }

  async function logout() {
    if (!supabaseConfigured || !supabase) return;
    await supabase.auth.signOut();
  }

  function selectProject(nextProject) {
    if (!nextProject) return;
    setProject(nextProject);
    localStorage.setItem('stock_project_id', nextProject.id);
  }

  const value = useMemo(
    () => ({
      session,
      profile,
      projects,
      project,
      loading,
      setupRequired,
      error,
      login,
      completeSuperAdminSetup,
      logout,
      selectProject,
      refresh: hydrate
    }),
    [session, profile, projects, project, loading, setupRequired, error]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
