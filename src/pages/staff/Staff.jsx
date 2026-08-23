import React, { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ConfirmButton from '../../components/ConfirmButton';
import { getStaff } from '../../services/api';
import { supabase } from '../../lib/supabase';

const emptyForm = { full_name: '', username: '', password: '' };

export default function Staff() {
  const { project } = useApp();
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setStaff(await getStaff(project));
  }

  useEffect(() => {
    if (project?.id) load().catch((e) => setError(e.message));
  }, [project?.id]);

  async function save() {
    setError('');

    try {
      const action = editingId ? 'update' : 'create';

      const { data, error: invokeError } = await supabase.functions.invoke('admin-user', {
      body: {
        action,
        role: 'staff',
        project_id: project.id,
        user_id: editingId,
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        password: form.password || undefined
      }
    });

      if (invokeError) {
      throw new Error(invokeError.message || 'Staff operation failed. Make sure the Supabase admin-user Edge Function is deployed.');
    }
      if (data?.error) throw new Error(data.error);

      setOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e?.message || 'Unable to create the staff account.');
      throw e;
    }
  }

  async function removeFromProject(staffId) {
    setError('');

      const { data, error: invokeError } = await supabase.functions.invoke('admin-user', {
      body: {
        action: 'remove_from_project',
        role: 'staff',
        project_id: project.id,
        user_id: staffId
      }
    });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

    await load();
  }

  async function restoreToProject(staffId) {
    setError('');

      const { data, error: invokeError } = await supabase.functions.invoke('admin-user', {
      body: {
        action: 'restore_membership',
        role: 'staff',
        project_id: project.id,
        user_id: staffId
      }
    });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

    await load();
  }

  const filtered = useMemo(
    () =>
      staff.filter((item) =>
        `${item.full_name} ${item.username}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [staff, search]
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow={window.location.pathname.startsWith('/admin/staff') ? 'ADMIN / STAFF' : 'STAFF'}
        title="Staff"
        description="Add, edit and delete staff access for the selected project. Historical submissions and audit history remain preserved."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              setError('');
              setEditingId(null);
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            <Plus size={17} />
            Add Staff
          </button>
        }
      />

      {error && <div className="form-error">{error}</div>}

      <section className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="muted">{filtered.length} staff</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.full_name}</strong></td>
                  <td>{item.username}</td>
                  <td>
                    {item.active
                      ? <StatusBadge status="normal">ACTIVE</StatusBadge>
                      : <StatusBadge status="pending">INACTIVE</StatusBadge>}
                  </td>
                  <td className="action-cell">
                    <button
                      className="icon-btn"
                      onClick={() => setMenu(menu === item.id ? null : item.id)}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {menu === item.id && (
                      <div className="action-menu">
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setForm({
                              full_name: item.full_name,
                              username: item.username,
                              password: ''
                            });
                            setOpen(true);
                            setMenu(null);
                          }}
                        >
                          Edit
                        </button>

                        {item.active ? (
                          <ConfirmButton
                            label="Delete from project"
                            className="menu-danger"
                            title="Delete Staff from Project"
                            message="The staff member will lose access to this project. Previous submissions and audit history will remain."
                            onConfirm={() => removeFromProject(item.id)}
                          />
                        ) : (
                          <ConfirmButton
                            label="Restore to project"
                            title="Restore Staff"
                            message="The staff member will regain access to this project."
                            onConfirm={() => restoreToProject(item.id)}
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td colSpan={4} className="loading-row">No staff found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        title={editingId ? 'Edit Staff' : 'Add Staff'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <ConfirmButton
              label={editingId ? 'Confirm & Save' : 'Confirm & Create'}
              title={editingId ? 'Save Staff Changes' : 'Create Staff Account'}
              message={
                editingId
                  ? 'The staff account details will be updated.'
                  : 'The new staff member will be able to sign in as Staff only.'
              }
              onConfirm={save}
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
            {editingId ? 'New password (optional)' : 'Password'}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingId}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
