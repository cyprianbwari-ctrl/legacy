import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ConfirmButton from '../../components/ConfirmButton';
import { getProjectUsers } from '../../services/api';
import { supabase } from '../../lib/supabase';

const emptyForm = { full_name: '', username: '', password: '', role: 'admin' };

export default function Users() {
  const { project, profile } = useApp();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() {
    setUsers(await getProjectUsers(project, ['admin', 'super_admin']));
  }

  useEffect(() => {
    if (project?.id) load().catch((e) => setError(e.message));
  }, [project?.id]);

  async function create() {
    setError('');

    const { data, error: invokeError } = await supabase.functions.invoke('admin-user', {
      body: {
        action: 'create',
        role: 'admin',
        project_id: project.id,
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        password: form.password
      }
    });

    if (invokeError) throw invokeError;
    if (data?.error) throw new Error(data.error);

    setOpen(false);
    setForm(emptyForm);
    await load();
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="ADMIN / USERS"
        title="Admin Users"
        description="Super Admin can create and manage management accounts."
        actions={
          <button className="btn btn-primary" onClick={() => { setError(''); setOpen(true); }}>
            <Plus size={17} />
            Add Admin
          </button>
        }
      />

      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.full_name}</strong></td>
                  <td>{user.username}</td>
                  <td>{user.role.replace('_', ' ')}</td>
                  <td>
                    {user.active
                      ? <StatusBadge status="normal">ACTIVE</StatusBadge>
                      : <StatusBadge status="pending">INACTIVE</StatusBadge>}
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td colSpan={4} className="loading-row">No Admin accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        title="Add Admin"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <ConfirmButton
              label="Confirm & Create"
              title="Create Admin Account"
              message="This creates a new management account for the selected project."
              onConfirm={create}
            />
          </>
        }
      >
        <div className="form-grid">
          <label className="full">
            Full name
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </label>
          <label>
            Username
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
      </Modal>
    </div>
  );
}
