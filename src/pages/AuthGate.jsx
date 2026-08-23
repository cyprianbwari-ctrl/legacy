import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useApp } from '../AppContext';
import Logo from '../components/Logo';

export default function AuthGate() {
  const {
    profile,
    setupRequired,
    session,
    error: appError,
    login,
    completeSuperAdminSetup,
    logout
  } = useApp();

  const [roleChoice, setRoleChoice] = useState('admin');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    confirm: '',
    company: 'Heritage Legacy',
    project: 'Heritage Housekeeping'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (setupRequired && session) {
      setRoleChoice('admin');
      setMode('complete-setup');
    }
  }, [setupRequired, session]);

  const title = useMemo(() => {
    if (mode === 'complete-setup') return 'Finish Super Admin setup';
    return 'Welcome back';
  }, [mode]);

  async function submit(event) {
    event.preventDefault();
    setError('');

    try {
      if (mode === 'complete-setup') {
        if (!form.name.trim()) throw new Error('Enter your full name.');
        if (!form.username.trim()) throw new Error('Enter your username.');
        const result = await completeSuperAdminSetup(
          form.name.trim(),
          form.username.trim(),
          form.company.trim(),
          form.project.trim()
        );
        if (result.error) throw result.error;
        return;
      }

      if (mode === 'setup-login') {
        const result = await login(form.username, form.password, 'admin');
        if (result.error) throw result.error;

        if (!result.needsSetup) return;

        setMode('complete-setup');
        return;
      }

      const result = await login(form.username, form.password, roleChoice);
      if (result.error) throw result.error;

      if (result.needsSetup) {
        if (roleChoice !== 'admin') {
          throw new Error('This Auth account has no application role yet. Complete the first Super Admin setup through the Admin access option.');
        }
        setMode('complete-setup');
      }
    } catch (e) {
      setError(e.message || 'Unable to continue.');
    }
  }

  if (profile) return null;

  if (!session && !roleChoice) {
    // Intentionally unreachable in normal flow, kept for clarity.
    setRoleChoice('admin');
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo />

        {mode !== 'complete-setup' && (
          <div className="auth-copy">
            <h1>Stock Control</h1>
            <p>Select your access type before signing in.</p>
          </div>
        )}

        {mode === 'complete-setup' ? (
          <>
            <button
              className="back-link"
              type="button"
              onClick={async () => {
                setError('');
                setMode('login');
                await logout();
              }}
            >
              <ArrowLeft size={16} />
              Back to Admin Login
            </button>

            <div className="auth-copy">
              <div className="access-chip"><ShieldCheck size={15} /> Super Admin Setup</div>
              <h1>{title}</h1>
              <p>Your Supabase Auth account exists, but the application profile has not been linked yet.</p>
            </div>

            <form onSubmit={submit} className="form-stack">
              <label>
                Full name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Full name"
                />
              </label>

              <label>
                Username
                <div className="input-icon">
                  <UserRound size={16} />
                  <input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    autoComplete="username"
                    placeholder="Username"
                  />
                </div>
              </label>

              <label>
                Company
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  required
                />
              </label>

              <label>
                First project
                <input
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  required
                />
              </label>

              {(error || appError) && <div className="form-error">{error || appError}</div>}

              <button className="btn btn-primary btn-lg" type="submit">
                Complete Super Admin Setup
              </button>
            </form>

            <p className="auth-note">
              This step creates your application profile and links your existing Supabase Auth account to the company and project.
            </p>
          </>
        ) : (
          <>
            <div className="role-grid">
              <button
                type="button"
                className={`role-option ${roleChoice === 'admin' ? 'selected' : ''}`}
                onClick={() => setRoleChoice('admin')}
              >
                <ShieldCheck />
                <strong>Admin</strong>
                <span>Management, stock, reports and audit</span>
              </button>

              <button
                type="button"
                className={`role-option ${roleChoice === 'staff' ? 'selected' : ''}`}
                onClick={() => setRoleChoice('staff')}
              >
                <Users />
                <strong>Staff</strong>
                <span>Daily consumption submission</span>
              </button>
            </div>

            <div className="auth-copy">
              <div className="access-chip">
                {roleChoice === 'admin' ? <ShieldCheck size={15} /> : <Users size={15} />}
                {roleChoice === 'admin' ? 'Admin Login' : 'Staff Login'}
              </div>
              <h1>Welcome back</h1>
              <p>Enter your account credentials to continue.</p>
            </div>

            {roleChoice === 'admin' && (
              <button
                className="setup-link"
                type="button"
                onClick={() => setMode(mode === 'setup-login' ? 'login' : 'setup-login')}
              >
                {mode === 'setup-login' ? 'Back to login' : 'First-time Super Admin setup'}
              </button>
            )}

            <form onSubmit={submit} className="form-stack">
              <label>
                Username
                <div className="input-icon">
                  <UserRound size={16} />
                  <input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    autoComplete="username"
                    placeholder="Username or email"
                  />
                </div>
              </label>

              <label>
                Password
                <div className="input-icon">
                  <LockKeyhole size={16} />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    autoComplete="current-password"
                    placeholder="Password"
                  />
                </div>
              </label>

              {(error || appError) && <div className="form-error">{error || appError}</div>}

              <button className="btn btn-primary btn-lg" type="submit">
                {mode === 'setup-login' ? 'Sign In & Continue' : 'Sign In'}
              </button>
            </form>

            {mode === 'setup-login' && (
              <div className="notice info">
                <ShieldCheck size={17} />
                <div>
                  <strong>One-time setup</strong>
                  <span>For the first account, create the Auth user once in Supabase Authentication, then use this screen to link it to the application.</span>
                </div>
              </div>
            )}

            <p className="auth-note">
              Access is verified against the actual account role. Selecting Admin does not grant Admin privileges.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
