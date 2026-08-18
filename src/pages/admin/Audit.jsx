import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Search, X } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import { getAudit } from '../../services/api';
import { downloadCsv } from '../../lib/csv';

const emptyFilters = {
  search: '',
  from: '',
  to: '',
  admin: 'all',
  product: 'all',
  staff: 'all',
  action: 'all'
};

function detailsText(row) {
  try {
    return JSON.stringify(row.details || {}).toLowerCase();
  } catch {
    return '';
  }
}

function rowLabel(row) {
  const d = row.details || {};
  return d.name || d.full_name || d.username || d.product_name || d.staff_name || '';
}

function formatDetails(row) {
  const d = row.details || {};
  const parts = Object.entries(d)
    .filter(([key, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
  return parts.join(' • ');
}

function csvRows(rows) {
  return rows.map((r) => ({
    date: new Date(r.created_at).toLocaleString(),
    admin: r.profiles?.full_name || 'System',
    username: r.profiles?.username || '',
    action: r.action,
    entity: r.entity_type,
    entity_id: r.entity_id || '',
    product_or_staff: rowLabel(r),
    details: formatDetails(r)
  }));
}

function exportExcel(rows) {
  import('xlsx').then(({ utils, writeFile }) => {
    const sheet = utils.json_to_sheet(csvRows(rows));
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, 'Audit Trail');
    writeFile(workbook, `stock-control-audit-${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

function exportPdf(rows) {
  import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 12;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 16;

    doc.setFontSize(16);
    doc.text('Stock Control — Audit Trail', margin, y);
    y += 7;
    doc.setFontSize(8);
    doc.text(`Exported ${new Date().toLocaleString()} • ${rows.length} records`, margin, y);
    y += 8;

    const columns = [
      ['Date / Time', 43],
      ['Admin / Staff', 38],
      ['Action', 42],
      ['Entity', 30],
      ['Details', pageWidth - margin * 2 - 153]
    ];

    const drawHeader = () => {
      let x = margin;
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      columns.forEach(([label, width]) => {
        doc.text(label, x, y);
        x += width;
      });
      doc.setFont(undefined, 'normal');
      y += 5;
    };

    drawHeader();
    rows.forEach((row) => {
      if (y > pageHeight - 12) {
        doc.addPage();
        y = 15;
        drawHeader();
      }
      const values = [
        new Date(row.created_at).toLocaleString(),
        row.profiles?.full_name || 'System',
        row.action,
        row.entity_type,
        formatDetails(row) || '—'
      ];
      let x = margin;
      values.forEach((value, i) => {
        const width = columns[i][1];
        const lines = doc.splitTextToSize(String(value), width - 2);
        doc.text(lines.slice(0, 2), x, y);
        x += width;
      });
      y += 8;
    });

    doc.save(`stock-control-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
  });
}

export default function Audit() {
  const { project } = useApp();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!project?.id) return;
    setLoading(true);
    setError('');
    try {
      setRows(await getAudit(project));
    } catch (e) {
      setError(e.message || 'Unable to load the audit trail.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [project?.id]);

  const admins = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const id = r.actor_id || 'system';
      const name = r.profiles?.full_name || 'System';
      map.set(id, name);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const actions = useMemo(
    () => [...new Set(rows.map((r) => r.action).filter(Boolean))].sort(),
    [rows]
  );

  const products = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.entity_type === 'product' || r.details?.product_name || r.details?.name) {
        const id = r.entity_id || rowLabel(r);
        const name = r.details?.product_name || (r.entity_type === 'product' ? r.details?.name : '');
        if (name) map.set(id, name);
      }
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const staff = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const action = r.action || '';
      const isStaff = action.startsWith('staff.') || r.details?.staff_name || r.entity_type === 'staff';
      if (isStaff) {
        const id = r.details?.user_id || r.entity_id || rowLabel(r);
        const name = r.details?.staff_name || r.details?.full_name || rowLabel(r);
        if (name) map.set(id, name);
      }
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const haystack = `${r.action} ${r.entity_type} ${r.profiles?.full_name || ''} ${r.profiles?.username || ''} ${detailsText(r)} ${r.entity_id || ''}`;
    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
    const date = new Date(r.created_at);
    if (filters.from && date < new Date(`${filters.from}T00:00:00`)) return false;
    if (filters.to && date > new Date(`${filters.to}T23:59:59.999`)) return false;
    if (filters.admin !== 'all' && (r.actor_id || 'system') !== filters.admin) return false;
    if (filters.action !== 'all' && r.action !== filters.action) return false;
    if (filters.product !== 'all') {
      const productName = products.find(([id]) => id === filters.product)?.[1];
      if (!detailsText(r).includes(String(productName || '').toLowerCase()) && r.entity_id !== filters.product) return false;
    }
    if (filters.staff !== 'all') {
      const staffName = staff.find(([id]) => id === filters.staff)?.[1];
      if (!detailsText(r).includes(String(staffName || '').toLowerCase()) && r.entity_id !== filters.staff && r.details?.user_id !== filters.staff) return false;
    }
    return true;
  }), [rows, filters, products, staff]);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters(emptyFilters);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== 'search' ? value !== '' && value !== 'all' : Boolean(value)).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="ADMIN / AUDIT"
        title="Audit Trail"
        description="Permanent history of who changed what, when, and in which project."
        actions={
          <div className="button-row">
            <button className="btn btn-secondary" onClick={() => downloadCsv('stock-control-audit.csv', csvRows(filtered))} disabled={!filtered.length}>
              <Download size={16} /> CSV
            </button>
            <button className="btn btn-secondary" onClick={() => exportExcel(filtered)} disabled={!filtered.length}>
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button className="btn btn-secondary" onClick={() => exportPdf(filtered)} disabled={!filtered.length}>
              <FileText size={16} /> PDF
            </button>
          </div>
        }
      />

      {error && <div className="form-error">{error}</div>}

      <section className="card">
        <div className="filter-bar audit-filters">
          <div className="search-box"><Search size={16} /><input placeholder="Search audit..." value={filters.search} onChange={(e) => setFilter('search', e.target.value)} /></div>
          <label>From<input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} /></label>
          <label>To<input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} /></label>
          <select value={filters.admin} onChange={(e) => setFilter('admin', e.target.value)}><option value="all">All Admins / Actors</option>{admins.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select value={filters.action} onChange={(e) => setFilter('action', e.target.value)}><option value="all">All Actions</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <select value={filters.product} onChange={(e) => setFilter('product', e.target.value)}><option value="all">All Products</option>{products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select value={filters.staff} onChange={(e) => setFilter('staff', e.target.value)}><option value="all">All Staff</option>{staff.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          {activeFilterCount > 0 && <button className="btn btn-secondary" onClick={clearFilters}><X size={15} />Clear</button>}
        </div>

        <div className="toolbar"><span className="muted">{loading ? 'Loading…' : `${filtered.length} of ${rows.length} records`}</span></div>

        <div className="table-wrap">
          <table className="data-table audit-table">
            <thead><tr><th>Date / Time</th><th>Admin / Staff</th><th>Action</th><th>Entity</th><th>Product / Staff</th><th>Details</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td><strong>{r.profiles?.full_name || 'System'}</strong><div className="muted">{r.profiles?.username || ''}</div></td>
                  <td><strong>{r.action}</strong></td>
                  <td>{r.entity_type}</td>
                  <td>{rowLabel(r) || '—'}</td>
                  <td className="audit-details">{formatDetails(r) || '—'}</td>
                </tr>
              ))}
              {!loading && !filtered.length && <tr><td colSpan={6} className="loading-row">No audit records match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
