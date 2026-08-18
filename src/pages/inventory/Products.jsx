import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Download, MoreHorizontal, Plus, Upload, Search } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import ConfirmButton from '../../components/ConfirmButton';
import StatusBadge from '../../components/StatusBadge';
import {
  getAllProducts,
  upsertProduct,
  setProductActive,
  deleteProduct
} from '../../services/api';
import { unitLabel } from '../../lib/format';
import { downloadCsv, parseCsv } from '../../lib/csv';

const blank = {
  name: '',
  unit: 'piece',
  full_stock: 0,
  order_point: 0,
  low_stock_point: 0,
  active: true,
  packaging: {},
  notes: ''
};

export default function Products() {
  const { project, profile } = useApp();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const canManageProducts = profile?.role === 'admin' || profile?.role === 'super_admin';

  async function load() {
    if (!project?.id) return;
    try {
      setError('');
      setProducts(await getAllProducts(project));
    } catch (err) {
      setError(err?.message || 'Unable to load products.');
    }
  }

  useEffect(() => {
    load();
  }, [project?.id]);

  function openAdd() {
    setEditing(null);
    setForm({ ...blank, packaging: {} });
    setError('');
    setOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    setForm({
      ...blank,
      ...product,
      packaging: product.packaging || {}
    });
    setError('');
    setOpen(true);
    setMenu(null);
  }

  async function save() {
    const name = String(form.name || '').trim();
    if (!name) {
      setError('Product name is required.');
      return;
    }

    try {
      setError('');
      await upsertProduct(
        project,
        {
          ...form,
          name,
          id: editing?.id,
          packaging: { ...(form.packaging || {}), base: form.unit }
        },
        profile.id
      );
      setOpen(false);
      await load();
    } catch (err) {
      setError(err?.message || 'Unable to save the product.');
    }
  }

  async function changeActive(product, active) {
    try {
      setError('');
      await setProductActive(project, product.id, active, profile.id);
      await load();
      setMenu(null);
    } catch (err) {
      setError(err?.message || `Unable to ${active ? 'activate' : 'deactivate'} the product.`);
    }
  }

  async function removeProduct() {
    if (!deleteTarget) return;
    try {
      setError('');
      await deleteProduct(project, deleteTarget.id, profile.id);
      setDeleteTarget(null);
      setMenu(null);
      await load();
    } catch (err) {
      setDeleteTarget(null);
      setError(err?.message || 'Unable to delete this product. If it has historical records, deactivate it instead.');
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function exportProducts() {
    downloadCsv(
      'products.csv',
      products.map((p) => ({
        name: p.name,
        unit: p.unit,
        full_stock: p.full_stock,
        order_point: p.order_point,
        low_stock_point: p.low_stock_point,
        active: p.active,
        packaging: JSON.stringify(p.packaging || {}),
        notes: p.notes || ''
      }))
    );
  }

  async function importFile(file) {
    try {
      setError('');
      const rows = await parseCsv(file);
      for (const r of rows) {
        if (!r.name) continue;
        let packaging = {};
        try {
          packaging = r.packaging ? JSON.parse(r.packaging) : {};
        } catch {
          packaging = {};
        }
        await upsertProduct(
          project,
          {
            name: r.name.trim(),
            unit: (r.unit || 'piece').toLowerCase(),
            full_stock: Number(r.full_stock || 0),
            order_point: Number(r.order_point || 0),
            low_stock_point: Number(r.low_stock_point || 0),
            active: (r.active ?? 'true') !== 'false',
            packaging,
            notes: r.notes || ''
          },
          profile.id
        );
      }
      await load();
      setImportOpen(false);
    } catch (err) {
      setError(err?.message || 'Unable to import products.');
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="INVENTORY / PRODUCTS"
        title="Products"
        description="Manage products, units, thresholds and activation status."
        actions={
          <>
            {canManageProducts && (
              <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
                <Upload size={16} />Import
              </button>
            )}
            <button className="btn btn-secondary" onClick={exportProducts}>
              <Download size={16} />Export
            </button>
            {canManageProducts && (
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={17} />Add Product
              </button>
            )}
          </>
        }
      />

      {error && <div className="form-error">{error}</div>}

      <section className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="muted">{filtered.length} products</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Full Stock</th>
                <th>Order Point</th>
                <th>Low Stock</th>
                <th>Status</th>
                {canManageProducts && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{unitLabel(p.unit)}</td>
                  <td>{p.full_stock}</td>
                  <td>{p.order_point}</td>
                  <td>{p.low_stock_point}</td>
                  <td>
                    {p.active ? (
                      <StatusBadge status="normal">ACTIVE</StatusBadge>
                    ) : (
                      <StatusBadge status="pending">INACTIVE</StatusBadge>
                    )}
                  </td>
                  {canManageProducts && (
                    <td className="action-cell">
                      <button
                        className="icon-btn"
                        onClick={() => setMenu(menu === p.id ? null : p.id)}
                        aria-label={`Actions for ${p.name}`}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {menu === p.id && (
                        <div className="action-menu">
                          <button onClick={() => openEdit(p)}>Edit</button>
                          {p.active ? (
                            <button className="danger-text" onClick={() => changeActive(p, false)}>
                              Deactivate
                            </button>
                          ) : (
                            <button onClick={() => changeActive(p, true)}>Activate</button>
                          )}
                          <button className="danger-text" onClick={() => {
                            setDeleteTarget(p);
                            setMenu(null);
                          }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        title={editing ? 'Edit Product' : 'Add Product'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <ConfirmButton
              label="Confirm & Save"
              title={editing ? 'Confirm Product Changes' : 'Confirm New Product'}
              message="This change will be recorded in the audit log."
              onConfirm={save}
            />
          </>
        }
      >
        <div className="form-grid">
          <label className="full">
            Product name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Unit
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {['case', 'pack', 'packet', 'roll', 'piece', 'pad', 'kg', 'litre', 'gram', 'box', 'bottle', 'other'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Full stock
            <input type="number" min="0" step="0.001" value={form.full_stock} onChange={(e) => setForm({ ...form, full_stock: Number(e.target.value) })} />
          </label>
          <label>
            Order point
            <input type="number" min="0" step="0.001" value={form.order_point} onChange={(e) => setForm({ ...form, order_point: Number(e.target.value) })} />
          </label>
          <label>
            Low stock point
            <input type="number" min="0" step="0.001" value={form.low_stock_point} onChange={(e) => setForm({ ...form, low_stock_point: Number(e.target.value) })} />
          </label>
          <label>
            Case contains (base units)
            <input type="number" min="0" step="0.001" value={form.packaging?.case || ''} onChange={(e) => setForm({ ...form, packaging: { ...form.packaging, case: Number(e.target.value) } })} placeholder="Optional" />
          </label>
          <label>
            Pack contains (base units)
            <input type="number" min="0" step="0.001" value={form.packaging?.pack || ''} onChange={(e) => setForm({ ...form, packaging: { ...form.packaging, pack: Number(e.target.value) } })} placeholder="Optional" />
          </label>
          <label className="full">
            Notes
            <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Product"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={removeProduct}>Delete Product</button>
          </>
        }
      >
        <p>
          Delete <strong>{deleteTarget?.name}</strong> permanently?
        </p>
        <p className="muted">
          This is only allowed when the product has no historical records that reference it. If it has records, use Deactivate instead so your reporting history remains intact.
        </p>
      </Modal>

      <Modal
        open={importOpen}
        title="Import Products"
        onClose={() => setImportOpen(false)}
        footer={<button className="btn btn-secondary" onClick={() => setImportOpen(false)}>Close</button>}
      >
        <div className="import-box">
          <Upload size={26} />
          <h3>Import a CSV file</h3>
          <p>Use the provided legacy_products.csv as the starting template. Preview the data in Excel before importing.</p>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Choose CSV</button>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              const res = await fetch('/data/legacy_products.csv');
              const blob = await res.blob();
              await importFile(new File([blob], 'legacy_products.csv', { type: 'text/csv' }));
            }}
          >Load Legacy Checklist</button>
          <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button className="text-link" onClick={() => window.open('/data/legacy_products.csv', '_blank')}>Open template</button>
        </div>
      </Modal>
    </div>
  );
}
