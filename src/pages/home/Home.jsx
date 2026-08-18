import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, PackageOpen } from 'lucide-react';
import { useApp } from '../../AppContext';
import PageHeader from '../../components/PageHeader';
import MetricCard from '../../components/MetricCard';
import StatusBadge from '../../components/StatusBadge';
import {
  getCurrentBalances,
  getMySubmissionStatus,
  getProducts,
  getReportsInRange,
  getMonthlyReportMatrix,
  getReport
} from '../../services/api';
import { weekFor, formatNumber, formatPeriod, dateKey } from '../../lib/periods';
import { statusFor } from '../../lib/format';

export default function Home() {
  const { project, profile } = useApp();
  const [products, setProducts] = useState([]);
  const [balances, setBalances] = useState({});
  const [weeklyRows, setWeeklyRows] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [todayReport, setTodayReport] = useState(null);
  const [staffStatus, setStaffStatus] = useState({ submitted: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const week = weekFor(new Date());
  const isStaff = profile?.role === 'staff';

  useEffect(() => {
    if (!project?.id || !profile?.id) return;

    let alive = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const currentProducts = await getProducts(project);

        if (!alive) return;
        setProducts(currentProducts);

        if (isStaff) {
          const status = await getMySubmissionStatus(project, dateKey(new Date()));
          if (alive) setStaffStatus(status);
          return;
        }

        const [reports, monthly, currentBalances, today] = await Promise.all([
          getReportsInRange(project, week.start, week.end),
          getMonthlyReportMatrix(project, new Date(), currentProducts),
          getCurrentBalances(project, currentProducts),
          getReport(project, dateKey(new Date()))
        ]);

        if (!alive) return;

        const usageByProduct = {};
        for (const report of reports) {
          for (const usage of report.daily_usage || []) {
            usageByProduct[usage.product_id] =
              (usageByProduct[usage.product_id] || 0) + Number(usage.quantity || 0);
          }
        }

        setWeeklyRows(
          currentProducts.map((product) => ({
            ...product,
            total: Number(usageByProduct[product.id] || 0),
            balance: Number(currentBalances[product.id] ?? product.full_stock ?? 0)
          }))
        );

        setMonthlyRows(monthly);
        setBalances(currentBalances);
        setTodayReport(today);
      } catch (e) {
        if (alive) setError(e.message || 'Unable to load the Home page.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [project?.id, profile?.id, isStaff]);

  if (isStaff) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="HOME"
          title={`Good morning, ${profile?.full_name?.split(' ')[0] || 'Staff'}`}
          description="Here's what's happening today."
        />

        <section className="card staff-home-card">
          <div className="staff-home-icon">
            <CheckCircle2 size={24} />
          </div>

          <div>
            <div className="eyebrow">TODAY'S REPORT</div>
            <h2>
              {staffStatus.submitted
                ? 'Report submitted'
                : 'Daily report awaiting submission'}
            </h2>
            <p>
              {staffStatus.submitted
                ? 'Your submission is locked. Staff cannot view or edit submitted quantities.'
                : 'Enter today’s usage for all active products and submit once.'}
            </p>
          </div>

          {!staffStatus.submitted && (
            <a className="btn btn-primary btn-lg" href="/usage/daily">
              Start Daily Report <ArrowRight size={17} />
            </a>
          )}

          {staffStatus.submitted && (
            <StatusBadge status="submitted">SUBMITTED</StatusBadge>
          )}
        </section>
      </div>
    );
  }

  const low = weeklyRows.filter(
    (row) => statusFor(row.balance, row) === 'low'
  );

  const order = weeklyRows.filter(
    (row) => statusFor(row.balance, row) === 'order'
  );

  const weekUsage = weeklyRows.reduce(
    (sum, row) => sum + Number(row.total || 0),
    0
  );

  const monthUsage = monthlyRows.reduce(
    (sum, row) => sum + Number(row.total || 0),
    0
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="HOME"
        title={`Good morning, ${profile?.full_name?.split(' ')[0] || 'Admin'}`}
        description="Here's what's happening today."
      />

      {error && <div className="form-error">{error}</div>}

      <section className="metric-grid three">
        <MetricCard
          label="Today's Report"
          value={todayReport ? '✓ SUBMITTED' : 'NOT SUBMITTED'}
          sub={todayReport ? `Submitted by ${todayReport.profiles?.full_name || 'Staff'}` : 'Report status'}
          tone={todayReport ? 'success' : 'warning'}
          icon={todayReport ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        />

        <MetricCard
          label="This Week"
          value={formatNumber(weekUsage)}
          sub="Total usage"
        />

        <MetricCard
          label="This Month"
          value={formatNumber(monthUsage)}
          sub="Usage summary"
        />
      </section>

      <section className="split-grid">
        <div className="card attention-card">
          <div className="card-head">
            <div>
              <h2>Stock Attention</h2>
              <p>Products approaching or below their Admin thresholds.</p>
            </div>
            <PackageOpen size={20} />
          </div>

          <div className="attention-summary">
            <div className="attention-count danger">
              <span>●</span>
              <strong>{loading ? '—' : low.length}</strong>
              <small>Low Stock</small>
            </div>
            <div className="attention-count warning">
              <span>●</span>
              <strong>{loading ? '—' : order.length}</strong>
              <small>Order Point</small>
            </div>
          </div>

          <a className="text-link" href="/inventory/stock">
            View Inventory <ArrowRight size={15} />
          </a>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Today's Report</h2>
              <p>Submission status for the current reporting day.</p>
            </div>
          </div>

          {todayReport ? (
            <div className="report-status">
              <StatusBadge status="submitted">Submitted</StatusBadge>
              <div>
                <strong>{todayReport.profiles?.full_name || 'Staff member'}</strong>
                <span>Report received</span>
              </div>
            </div>
          ) : (
            <div className="report-status">
              <StatusBadge status="pending">Not submitted</StatusBadge>
              <div>
                <strong>Waiting for submission</strong>
                <span>Admin can monitor the Daily page.</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Attention</h2>
            <p>{formatPeriod(week)} · Saturday–Thursday</p>
          </div>
          <span className="muted">Friday excluded</span>
        </div>

        <div className="attention-list">
          {loading && <div className="loading-row">Loading stock…</div>}

          {!loading &&
            weeklyRows
              .filter((row) => statusFor(row.balance, row) !== 'normal')
              .slice(0, 8)
              .map((row) => {
                const status = statusFor(row.balance, row);
                const threshold = status === 'low'
                  ? row.low_stock_point
                  : row.order_point;

                return (
                  <div className="attention-row" key={row.id}>
                    <div className={`attention-dot ${status}`} />
                    <strong>{row.name}</strong>
                    <span className="row-spacer" />
                    <span>Balance <b>{formatNumber(row.balance)}</b></span>
                    <span>{status === 'low' ? 'Low Stock' : 'Order Point'}: {formatNumber(threshold)}</span>
                    <StatusBadge status={status}>
                      {status === 'low' ? 'LOW STOCK' : 'ORDER POINT'}
                    </StatusBadge>
                  </div>
                );
              })}

          {!loading &&
            !weeklyRows.some(
              (row) => statusFor(row.balance, row) !== 'normal'
            ) && (
              <div className="healthy-state">
                <CheckCircle2 size={20} />
                <span>All active products are above their thresholds.</span>
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
