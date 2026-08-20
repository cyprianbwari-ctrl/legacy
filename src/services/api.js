import { supabase, supabaseConfigured } from '../lib/supabase';
import { addDays, dateKey, monthWeeks, REPORTING_DAYS } from '../lib/periods';

function requireProject(project) {
  if (!project?.id) throw new Error('No project is selected.');
}

function cleanRows(rows) {
  return rows.map((row) => ({
    product_id: row.product_id,
    quantity: Number(row.quantity || 0)
  }));
}

export async function getProducts(project) {
  requireProject(project);
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('project_id', project.id)
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getAllProducts(project) {
  requireProject(project);
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('project_id', project.id)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertProduct(project, payload, userId) {
  requireProject(project);
  const row = {
    ...payload,
    project_id: project.id,
    full_stock: Number(payload.full_stock || 0),
    order_point: Number(payload.order_point || 0),
    low_stock_point: Number(payload.low_stock_point || 0)
  };

  const { data, error } = await supabase.from('products').upsert(row).select().single();
  if (error) throw error;

  await audit(
    project.id,
    userId,
    payload.id ? 'product.updated' : 'product.created',
    'product',
    data.id,
    {
      name: data.name,
      unit: data.unit,
      full_stock: data.full_stock,
      order_point: data.order_point,
      low_stock_point: data.low_stock_point,
      packaging: data.packaging
    }
  );

  return data;
}

export async function setProductActive(project, productId, active, userId) {
  requireProject(project);
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id,name,unit,active')
    .eq('id', productId)
    .eq('project_id', project.id)
    .single();
  if (productError) throw productError;

  const { error } = await supabase
    .from('products')
    .update({ active })
    .eq('id', productId)
    .eq('project_id', project.id);
  if (error) throw error;

  await audit(
    project.id,
    userId,
    active ? 'product.activated' : 'product.deactivated',
    'product',
    productId,
    { active, name: product.name, unit: product.unit }
  );
}

export async function deleteProduct(project, productId, userId) {
  requireProject(project);

  const { error } = await supabase.rpc('delete_product', {
    p_project_id: project.id,
    p_product_id: productId,
    p_actor_id: userId
  });

  if (error) throw error;
}

export async function getProjectUsers(project, roles = ['admin', 'super_admin']) {
  requireProject(project);

  const { data, error } = await supabase
    .from('project_memberships')
    .select('user_id,active,profiles(id,full_name,username,role,active)')
    .eq('project_id', project.id);

  if (error) throw error;

  return (data || [])
    .map((item) => {
      if (!item.profiles) return null;
      return {
        ...item.profiles,
        active: Boolean(item.active && item.profiles.active),
        membership_active: Boolean(item.active)
      };
    })
    .filter(Boolean)
    .filter((item) => roles.includes(item.role));
}

export async function getStaff(project) {
  return getProjectUsers(project, ['staff']);
}

export async function assignStaff(project, date, staffId, adminId) {
  requireProject(project);

  const { data, error } = await supabase
    .from('staff_assignments')
    .upsert(
      {
        project_id: project.id,
        assignment_date: date,
        staff_id: staffId,
        assigned_by: adminId
      },
      { onConflict: 'project_id,assignment_date' }
    )
    .select()
    .single();

  if (error) throw error;

  await audit(project.id, adminId, 'staff.assigned', 'assignment', data.id, {
    date,
    staffId
  });

  return data;
}

export async function getAssignment(project, date) {
  requireProject(project);

  const { data, error } = await supabase
    .from('staff_assignments')
    .select('*, profiles(full_name,username)')
    .eq('project_id', project.id)
    .eq('assignment_date', date)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getReport(project, date) {
  requireProject(project);

  const { data, error } = await supabase
    .from('daily_reports')
    .select(
      '*, profiles:submitted_by(full_name,username), daily_usage(*, products(id,name,unit,packaging))'
    )
    .eq('project_id', project.id)
    .eq('report_date', date)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function submitDaily(project, date, submittedBy, usageRows) {
  requireProject(project);

  const rows = cleanRows(usageRows);

  const { data, error } = await supabase.rpc('submit_daily_report', {
    p_project_id: project.id,
    p_report_date: date,
    p_submitted_by: submittedBy,
    p_usage: rows
  });

  if (error) throw error;

  return data;
}

export async function updateDaily(project, reportId, adminId, usageRows) {
  requireProject(project);

  const rows = cleanRows(usageRows);

  const { error } = await supabase.rpc('admin_replace_daily_report', {
    p_report_id: reportId,
    p_editor_id: adminId,
    p_usage: rows
  });

  if (error) throw error;
}

export async function getReportsInRange(project, start, end) {
  requireProject(project);

  const { data, error } = await supabase
    .from('daily_reports')
    .select(
      '*, profiles:submitted_by(full_name,username), daily_usage(*, products(id,name,unit,packaging))'
    )
    .eq('project_id', project.id)
    .gte('report_date', dateKey(start))
    .lte('report_date', dateKey(end))
    .order('report_date');

  if (error) throw error;
  return data || [];
}

export async function getStockAdjustments(project) {
  requireProject(project);

  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*, products(name,unit), profiles:created_by(full_name)')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addStockAdjustment(
  project,
  productId,
  delta,
  reason,
  notes,
  userId
) {
  requireProject(project);

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('name,unit')
    .eq('id', productId)
    .eq('project_id', project.id)
    .single();
  if (productError) throw productError;

  const { data, error } = await supabase
    .from('stock_adjustments')
    .insert({
      project_id: project.id,
      product_id: productId,
      quantity_delta: Number(delta),
      reason,
      notes: notes || null,
      created_by: userId
    })
    .select()
    .single();

  if (error) throw error;

  await audit(project.id, userId, 'stock.adjusted', 'stock_adjustment', data.id, {
    productId,
    product_name: product.name,
    unit: product.unit,
    delta: Number(delta),
    reason,
    notes: notes || ''
  });

  return data;
}

export async function getAudit(project) {
  requireProject(project);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, profiles:actor_id(full_name,username)')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data || [];
}

export async function audit(projectId, actorId, action, entityType, entityId, details = {}) {
  if (!supabaseConfigured) return;

  const { error } = await supabase.from('audit_logs').insert({
    project_id: projectId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    details
  });

  if (error) throw error;
}

export async function getPeriodInitials(project, periodType, periodStart) {
  requireProject(project);

  const { data, error } = await supabase
    .from('period_initials')
    .select('product_id,initial_quantity')
    .eq('project_id', project.id)
    .eq('period_type', periodType)
    .eq('period_start', dateKey(periodStart));

  if (error) throw error;

  return Object.fromEntries(
    (data || []).map((item) => [item.product_id, Number(item.initial_quantity)])
  );
}

export async function savePeriodInitials(
  project,
  periodType,
  periodStart,
  values,
  adminId
) {
  requireProject(project);

  const rows = Object.entries(values).map(([product_id, initial_quantity]) => ({
    project_id: project.id,
    period_type: periodType,
    period_start: dateKey(periodStart),
    product_id,
    initial_quantity: Number(initial_quantity || 0),
    edited_by: adminId
  }));

  const { error } = await supabase
    .from('period_initials')
    .upsert(rows, {
      onConflict: 'project_id,period_type,period_start,product_id'
    });

  if (error) throw error;

  await audit(project.id, adminId, `${periodType}.initials.edited`, `${periodType}_initials`, null, {
    periodStart: dateKey(periodStart),
    values
  });
}

export async function getWeeklyReportMatrix(project, period, products) {
  requireProject(project);

  const reports = await getReportsInRange(project, period.start, period.end);
  const overrides = await getPeriodInitials(project, 'week', period.start);

  const byDate = Object.fromEntries(
    reports.map((report) => [report.report_date, report])
  );

  // The first week's starting stock comes from the product Full Stock unless
  // the Admin has explicitly overridden it.
  // Later weeks can carry the previous week's calculated balance.
  const previousPeriod = {
    start: addDays(period.start, -7),
    end: addDays(period.start, -2)
  };

  const previousReports = await getReportsInRange(
    project,
    previousPeriod.start,
    previousPeriod.end
  );

  const previousUsage = {};
  for (const report of previousReports) {
    for (const usage of report.daily_usage || []) {
      previousUsage[usage.product_id] =
        (previousUsage[usage.product_id] || 0) + Number(usage.quantity || 0);
    }
  }

  return products.map((product) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, product.id);
    const initial = hasOverride
      ? Number(overrides[product.id])
      : Math.max(
          0,
          Number(product.full_stock || 0) -
            Number(previousUsage[product.id] || 0)
        );

    const daily = REPORTING_DAYS.map((_, index) => {
      const report = byDate[dateKey(addDays(period.start, index))];

      if (!report) return null;

      const item = (report.daily_usage || []).find(
        (usage) => usage.product_id === product.id
      );

      return Number(item?.quantity || 0);
    });

    const total = daily.reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );

    return {
      ...product,
      initial,
      daily,
      total,
      balance: Math.max(0, initial - total),
      reportIds: Object.fromEntries(
        REPORTING_DAYS.map((_, index) => {
          const key = dateKey(addDays(period.start, index));
          return [key, byDate[key]?.id || null];
        })
      )
    };
  });
}

export async function saveWeeklyMatrix(project, period, rows, adminId) {
  requireProject(project);

  const payload = rows.map((row) => ({
    product_id: row.id,
    initial: Number(row.initial || 0),
    daily: row.daily.map((value) => Number(value || 0))
  }));

  const { error } = await supabase.rpc('admin_save_week', {
    p_project_id: project.id,
    p_week_start: dateKey(period.start),
    p_editor_id: adminId,
    p_rows: payload
  });

  if (error) throw error;
}

export async function getMonthlyReportMatrix(project, monthDate, products) {
  requireProject(project);

  const weeks = monthWeeks(
    monthDate.getFullYear(),
    monthDate.getMonth()
  );

  const weekRows = [];
  for (const week of weeks) {
    weekRows.push(await getWeeklyReportMatrix(project, week, products));
  }

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const overrides = await getPeriodInitials(project, 'month', monthStart);

  const { data: usageOverrides, error } = await supabase
    .from('monthly_usage_overrides')
    .select('product_id,week_number,quantity')
    .eq('project_id', project.id)
    .eq('month_start', dateKey(monthStart));

  if (error) throw error;

  const overrideMap = Object.fromEntries(
    (usageOverrides || []).map((item) => [
      `${item.product_id}:${item.week_number}`,
      Number(item.quantity)
    ])
  );

  return products.map((product, productIndex) => {
    const firstWeekInitial =
      weekRows[0]?.[productIndex]?.initial ??
      Number(product.full_stock || 0);

    const initial =
      Number(overrides[product.id] ?? firstWeekInitial);

    const weekTotals = weekRows.map((rows, weekIndex) =>
      Number(
        overrideMap[`${product.id}:${weekIndex + 1}`] ??
          rows[productIndex]?.total ??
          0
      )
    );

    const total = weekTotals.reduce((sum, value) => sum + value, 0);

    return {
      ...product,
      initial,
      weekTotals,
      total,
      balance: Math.max(0, initial - total),
      weeks
    };
  });
}

export async function saveMonthlyMatrix(project, monthDate, rows, adminId) {
  requireProject(project);

  const monthStart = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );

  const payload = rows.map((row) => ({
    product_id: row.id,
    week_1: Number(row.weekTotals[0] || 0),
    week_2: Number(row.weekTotals[1] || 0),
    week_3: Number(row.weekTotals[2] || 0),
    week_4: Number(row.weekTotals[3] || 0)
  }));

  const { error } = await supabase.rpc('admin_save_month', {
    p_project_id: project.id,
    p_month_start: dateKey(monthStart),
    p_editor_id: adminId,
    p_rows: payload,
    p_initials: rows.map((row) => ({
      product_id: row.id,
      initial_quantity: Number(row.initial || 0)
    }))
  });

  if (error) throw error;
}

export async function getCurrentBalances(project, products) {
  requireProject(project);

  const { data: reports, error: reportError } = await supabase
    .from('daily_reports')
    .select('daily_usage(product_id,quantity)')
    .eq('project_id', project.id);

  if (reportError) throw reportError;

  const used = {};
  for (const report of reports || []) {
    for (const usage of report.daily_usage || []) {
      used[usage.product_id] =
        (used[usage.product_id] || 0) + Number(usage.quantity || 0);
    }
  }

  const { data: adjustments, error: adjustmentError } = await supabase
    .from('stock_adjustments')
    .select('product_id,quantity_delta')
    .eq('project_id', project.id);

  if (adjustmentError) throw adjustmentError;

  const adjusted = {};
  for (const item of adjustments || []) {
    adjusted[item.product_id] =
      (adjusted[item.product_id] || 0) + Number(item.quantity_delta || 0);
  }

  return Object.fromEntries(
    products.map((product) => [
      product.id,
      Math.max(
        0,
        Number(product.full_stock || 0) -
          Number(used[product.id] || 0) +
          Number(adjusted[product.id] || 0)
      )
    ])
  );
}

export async function getDailySubmissionStatus(project, date) {
  requireProject(project);

  const { data, error } = await supabase.rpc('daily_submission_status', {
    p_project_id: project.id,
    p_report_date: date
  }).maybeSingle();

  if (error) throw error;

  return data || {
    day_submitted: false,
    submitted_by_me: false,
    my_submitted_at: null
  };
}

export async function getMySubmissionStatus(project, date) {
  const status = await getDailySubmissionStatus(project, date);
  return {
    submitted: Boolean(status.submitted_by_me),
    submitted_at: status.my_submitted_at || null,
    day_submitted: Boolean(status.day_submitted)
  };
}

export async function getMyDailyReport(project, date) {
  requireProject(project);
  const { data, error } = await supabase.rpc('my_daily_report', {
    p_project_id: project.id,
    p_report_date: date
  });
  if (error) throw error;
  return data || null;
}

export async function requestDailyCorrection(project, reportId, usageRows, notes, userId) {
  requireProject(project);
  const { data, error } = await supabase.rpc('request_daily_correction', {
    p_project_id: project.id,
    p_report_id: reportId,
    p_requested_usage: cleanRows(usageRows),
    p_notes: notes?.trim() || null,
    p_requester_id: userId
  });
  if (error) throw error;
  return data;
}

export async function getDailyCorrectionRequests(project, reportId) {
  requireProject(project);
  const { data, error } = await supabase
    .from('daily_correction_requests')
    .select('*, profiles:requested_by(full_name,username)')
    .eq('project_id', project.id)
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function resolveDailyCorrection(project, requestId, decision, editorId) {
  requireProject(project);
  const { error } = await supabase.rpc('resolve_daily_correction', {
    p_request_id: requestId,
    p_decision: decision,
    p_editor_id: editorId
  });
  if (error) throw error;
}

export async function getStaffCorrectionPermission(project, reportId) {
  requireProject(project);
  const { data, error } = await supabase.rpc('staff_correction_permission', {
    p_project_id: project.id,
    p_report_id: reportId
  }).maybeSingle();
  if (error) throw error;
  return Boolean(data?.allowed);
}

export async function submitStaffCorrection(project, reportId, usageRows, userId) {
  requireProject(project);
  const { error } = await supabase.rpc('staff_replace_daily_report', {
    p_project_id: project.id,
    p_report_id: reportId,
    p_usage: cleanRows(usageRows),
    p_staff_id: userId
  });
  if (error) throw error;
}
