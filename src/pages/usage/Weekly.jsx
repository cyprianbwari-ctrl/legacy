import React from 'react';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../AppContext';
import { downloadCsv } from '../../lib/csv';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import ConfirmButton from '../../components/ConfirmButton';
import { getProducts, getWeeklyReportMatrix, saveWeeklyMatrix } from '../../services/api';
import { weekFor, shiftWeek, formatPeriod, addDays } from '../../lib/periods';
import { unitLabel, statusFor, formatQuantity } from '../../lib/format';

const reportingDays = [0, 1, 2, 3, 4, 5];

export default function Weekly() {
  const { project, profile } = useApp();
  const manager = ['admin', 'super_admin'].includes(profile?.role);
  const [period, setPeriod] = useState(weekFor(new Date()));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!project) return;
    setLoading(true);
    setError('');
    try {
      const products = await getProducts(project);
      const matrix = await getWeeklyReportMatrix(project, period, products);
      setRows(matrix);
    } catch (e) {
      setError(e.message || 'Unable to load the weekly report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [project?.id, period.key]);

  function updateInitial(productId, value) {
    const initial = Number(value || 0);
    setRows((current) =>
      current.map((row) =>
        row.id === productId
          ? { ...row, initial, balance: initial - row.total }
          : row
      )
    );
  }

  function updateDay(productId, dayIndex, value) {
    const quantity = value === '' ? 0 : Number(value);
    setRows((current) =>
      current.map((row) => {
        if (row.id !== productId) return row;
        const daily = [...row.daily];
        daily[dayIndex] = quantity;
        const total = daily.reduce((sum, item) => sum + (Number(item) || 0), 0);
        return { ...row, daily, total, balance: row.initial - total };
      })
    );
  }

  async function save() {
    try {
      await saveWeeklyMatrix(project, period, rows, profile.id);
      await load();
    } catch (e) {
      setError(e.message || 'Unable to save the weekly report.');
    }
  }

  const days = reportingDays.map((index) => addDays(period.start, index));

  function exportReport() {
    downloadCsv(
      `weekly-${period.start.toISOString().slice(0, 10)}.csv`,
      rows.map((row) => ({
        product: row.name,
        unit: row.unit,
        initial: row.initial,
        sat: row.daily[0] ?? '',
        sun: row.daily[1] ?? '',
        mon: row.daily[2] ?? '',
        tue: row.daily[3] ?? '',
        wed: row.daily[4] ?? '',
        thu: row.daily[5] ?? '',
        total_usage: row.total,
        balance: row.balance,
      }))
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="USAGE / WEEKLY"
        title="Weekly Usage"
        description={`${formatPeriod(period)} · Saturday–Thursday`}
        actions={
          <>
            <button className="btn btn-secondary" onClick={exportReport}>
              Export
            </button>
            <div className="period-nav">
              <button
                className="icon-btn"
                onClick={() => setPeriod(shiftWeek(period, -1))}
                aria-label="Previous week"
              >
                <ChevronLeft />
              </button>
              <strong>{formatPeriod(period)}</strong>
              <button
                className="icon-btn"
                onClick={() => setPeriod(shiftWeek(period, 1))}
                aria-label="Next week"
              >
                <ChevronRight />
              </button>
            </div>
          </>
        }
      />

      {error && <div className="form-error">{error}</div>}

      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>Whole Week Report</h2>
            <p>
              Every daily staff submission appears under its actual day. Friday is hidden.
            </p>
          </div>
          {manager && (
            <ConfirmButton
              label="Confirm & Save"
              title="Confirm Weekly Changes"
              message="You are changing the weekly report. This affects balances and the following week's carried stock."
              onConfirm={save}
            />
          )}
        </div>

        <div className="table-wrap">
          <table className="data-table weekly-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Initial</th>
                {days.map((day) => (
                  <th key={day.toISOString()}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    <small>{day.getDate()}</small>
                  </th>
                ))}
                <th>Total Usage</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="loading-row">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="loading-row">No products found.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const status = statusFor(row.balance, row);
                  return (
                    <tr key={row.id}>
                      <td><strong>{row.name}</strong></td>
                      <td>{unitLabel(row.unit)}</td>
                      <td>
                        {manager ? (
                          <input
                            className="qty-input compact"
                            type="number"
                            min="0"
                            step="0.001"
                            value={row.initial}
                            onChange={(event) => updateInitial(row.id, event.target.value)}
                          />
                        ) : (
                          formatQuantity(row.initial, row)
                        )}
                      </td>

                      {row.daily.map((value, dayIndex) => (
                        <td key={dayIndex}>
                          {manager ? (
                            <input
                              className="qty-input compact"
                              type="number"
                              min="0"
                              step="0.001"
                              value={value ?? ''}
                              onChange={(event) =>
                                updateDay(row.id, dayIndex, event.target.value)
                              }
                            />
                          ) : value === null ? (
                            '—'
                          ) : (
                            formatQuantity(value, row)
                          )}
                        </td>
                      ))}

                      <td><strong>{formatQuantity(row.total, row)}</strong></td>
                      <td
                        className={
                          status === 'low'
                            ? 'balance-danger'
                            : status === 'order'
                              ? 'balance-warning'
                              : ''
                        }
                      >
                        <strong>{formatQuantity(row.balance, row)}</strong>
                      </td>
                      <td>
                        <StatusBadge status={status}>
                          {status === 'low'
                            ? 'LOW STOCK'
                            : status === 'order'
                              ? 'ORDER POINT'
                              : 'NORMAL'}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="bottom-period-nav">
        <button className="btn btn-secondary" onClick={() => setPeriod(shiftWeek(period, -1))}>
          Previous Week
        </button>
        <button className="btn btn-primary" onClick={() => setPeriod(weekFor(new Date()))}>
          Current Week
        </button>
        <button className="btn btn-secondary" onClick={() => setPeriod(shiftWeek(period, 1))}>
          Next Week
        </button>
      </div>
    </div>
  );
}
