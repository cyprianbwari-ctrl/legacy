import { supabase, supabaseConfigured } from '../lib/supabase';
import { dateKey, weekFor, addDays, monthWeeks, REPORTING_DAYS } from '../lib/periods';

const demoProducts = [
  {id:'p1',name:'Toilet Rolls (10 rolls / pack)',unit:'roll',full_stock:148,order_point:40,low_stock_point:20,packaging:{case:120,pack:10,base:'roll'},active:true,legacy_initial:'12 case + 4 rolls'},
  {id:'p2',name:'Ecofresh facial tissue box, 150 sheets, 1x30 pkt',unit:'packet',full_stock:1139,order_point:360,low_stock_point:180,packaging:{case:30,base:'packet'},active:true,legacy_initial:'37 case + 29 pkt'},
  {id:'p3',name:'Maxi Roll Magic 450 sheets (1x6)',unit:'roll',full_stock:30,order_point:10,low_stock_point:5,active:true,legacy_initial:'30 rolls'},
  {id:'p4',name:'Autocut Hand Towel Roll - 2Ply 230 Mtr',unit:'roll',full_stock:42,order_point:12,low_stock_point:6,active:true,legacy_initial:'42 rolls'},
  {id:'p5',name:'Folded Tissue 200x15 3000 sheets 2ply',unit:'piece',full_stock:48,order_point:15,low_stock_point:8,active:true,legacy_initial:'48 pcs'},
  {id:'p6',name:'Clorox wipes',unit:'piece',full_stock:51,order_point:15,low_stock_point:8,active:true,legacy_initial:'51 pcs'},
  {id:'p7',name:'GLADE Air Freshener (300ml) Rose (WASHROOM)',unit:'piece',full_stock:8,order_point:3,low_stock_point:1,active:true,legacy_initial:'8 pcs'},
  {id:'p8',name:'GLADE Air Freshener (300ml) Lavender (RECEPTION)',unit:'piece',full_stock:10,order_point:3,low_stock_point:1,active:true,legacy_initial:'10 pcs'},
  {id:'p9',name:'Sanitary pads',unit:'pad',full_stock:15,order_point:6,low_stock_point:3,active:true,legacy_initial:'1 pack + 15 pads (verify)'},
  {id:'p10',name:'Kimbo Beans Aroma Bio Organic 1KG',unit:'kg',full_stock:18,order_point:6,low_stock_point:3,active:true,legacy_initial:'18 pcs (legacy sheet; unit requires Admin verification)'},
  {id:'p11',name:'RAINBOW Milk Organic Full Fat 1 LTR',unit:'litre',full_stock:98,order_point:30,low_stock_point:15,active:true,legacy_initial:'98 pcs'},
  {id:'p12',name:'Organic Brown Sugar SIS 500G',unit:'piece',full_stock:3,order_point:2,low_stock_point:1,active:true,legacy_initial:'3 pcs + handwritten mark (verify)'}
];

function ensureProject(project) {
  if (!project?.id) throw new Error('No project selected.');
}

export async function getProducts(project) {
  if (!supabaseConfigured) return demoProducts.filter(p=>p.active);
  ensureProject(project);
  const { data, error } = await supabase.from('products').select('*').eq('project_id',project.id).order('name');
  if (error) throw error;
  return data || [];
}

export async function getAllProducts(project) {
  if (!supabaseConfigured) return demoProducts;
  ensureProject(project);
  const { data, error } = await supabase.from('products').select('*').eq('project_id',project.id).order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertProduct(project, payload, userId) {
  if (!supabaseConfigured) return {...payload, id: payload.id || crypto.randomUUID()};
  ensureProject(project);
  const row = {...payload, project_id:project.id};
  const { data, error } = await supabase.from('products').upsert(row).select().single();
  if (error) throw error;
  await audit(project.id,userId,payload.id?'product.updated':'product.created','product',data.id,payload);
  return data;
}

export async function deactivateProduct(project, productId, userId) {
  if (!supabaseConfigured) return;
  const { error } = await supabase.from('products').update({active:false}).eq('id',productId).eq('project_id',project.id);
  if (error) throw error;
  await audit(project.id,userId,'product.deactivated','product',productId,{});
}

export async function getStaff(project) {
  if (!supabaseConfigured) return [
    {id:'s1',full_name:'Mary',username:'mary',role:'staff',active:true},
    {id:'s2',full_name:'John',username:'john',role:'staff',active:true}
  ];
  const { data: memberships, error } = await supabase
    .from('project_memberships')
    .select('user_id, profiles(id,full_name,username,role,active)')
    .eq('project_id',project.id);
  if (error) throw error;
  return (memberships||[]).map(x=>x.profiles).filter(Boolean);
}

export async function assignStaff(project, date, staffId, adminId) {
  if (!supabaseConfigured) return {assignment_date:date,staff_id:staffId};
  const { data, error } = await supabase.from('staff_assignments').upsert({
    project_id:project.id, assignment_date:date, staff_id:staffId, assigned_by:adminId
  },{onConflict:'project_id,assignment_date'}).select().single();
  if (error) throw error;
  await audit(project.id,adminId,'staff.assigned','assignment',data.id,{date,staffId});
  return data;
}

export async function getAssignment(project,date) {
  if (!supabaseConfigured) return null;
  const {data,error}=await supabase.from('staff_assignments').select('*, profiles(full_name,username)').eq('project_id',project.id).eq('assignment_date',date).maybeSingle();
  if(error) throw error; return data;
}

export async function getReport(project,date) {
  if (!supabaseConfigured) return null;
  const {data,error}=await supabase.from('daily_reports').select('*, profiles:submitted_by(full_name,username), daily_usage(*, products(*))').eq('project_id',project.id).eq('report_date',date).maybeSingle();
  if(error) throw error; return data;
}

export async function submitDaily(project,date,submittedBy,usageRows) {
  if (!supabaseConfigured) return {id:'demo-report',report_date:date,submitted_by:submittedBy,submitted_at:new Date().toISOString(),daily_usage:usageRows};
  const {data:existing}=await supabase.from('daily_reports').select('id').eq('project_id',project.id).eq('report_date',date).maybeSingle();
  if(existing) throw new Error('This day has already been submitted.');
  const {data:report,error}=await supabase.from('daily_reports').insert({
    project_id:project.id,report_date:date,submitted_by:submittedBy
  }).select().single();
  if(error) throw error;
  const rows=usageRows.map(x=>({report_id:report.id,product_id:x.product_id,quantity:Number(x.quantity||0)}));
  const {error:usageError}=await supabase.from('daily_usage').insert(rows);
  if(usageError) {
    await supabase.from('daily_reports').delete().eq('id',report.id);
    throw usageError;
  }
  await audit(project.id,submittedBy,'daily_report.submitted','daily_report',report.id,{reportDate:date});
  return {...report,daily_usage:rows};
}

export async function updateDaily(project,reportId,adminId,usageRows) {
  if(!supabaseConfigured) return;
  const {error}=await supabase.from('daily_usage').upsert(usageRows.map(x=>({report_id:reportId,product_id:x.product_id,quantity:Number(x.quantity||0)})),{onConflict:'report_id,product_id'});
  if(error) throw error;
  const {error:re}=await supabase.from('daily_reports').update({updated_at:new Date().toISOString()}).eq('id',reportId);
  if(re) throw re;
  await audit(project.id,adminId,'daily_report.edited','daily_report',reportId,{usageRows});
}

export async function getReportsInRange(project,start,end) {
  if(!supabaseConfigured) return [];
  const {data,error}=await supabase.from('daily_reports').select('*, profiles:submitted_by(full_name,username), daily_usage(*, products(id,name,unit))')
    .eq('project_id',project.id).gte('report_date',dateKey(start)).lte('report_date',dateKey(end)).order('report_date');
  if(error) throw error; return data||[];
}

export async function getStockAdjustments(project) {
  if(!supabaseConfigured) return [];
  const {data,error}=await supabase.from('stock_adjustments').select('*, products(name,unit), profiles:created_by(full_name)').eq('project_id',project.id).order('created_at',{ascending:false});
  if(error) throw error; return data||[];
}

export async function addStockAdjustment(project,productId,delta,reason,notes,userId) {
  if(!supabaseConfigured) return;
  const {data,error}=await supabase.from('stock_adjustments').insert({
    project_id:project.id,product_id:productId,quantity_delta:Number(delta),reason,notes,created_by:userId
  }).select().single();
  if(error) throw error;
  await audit(project.id,userId,'stock.adjusted','stock_adjustment',data.id,{productId,delta,reason});
}

export async function getAudit(project) {
  if(!supabaseConfigured) return [];
  const {data,error}=await supabase.from('audit_logs').select('*, profiles:actor_id(full_name,username)').eq('project_id',project.id).order('created_at',{ascending:false}).limit(500);
  if(error) throw error; return data||[];
}

export async function audit(projectId,actorId,action,entityType,entityId,details={}) {
  if(!supabaseConfigured) return;
  await supabase.from('audit_logs').insert({project_id:projectId,actor_id:actorId,action,entity_type:entityType,entity_id:entityId,details});
}

export function demoWeeklyUsage(products, period=weekFor(new Date())) {
  const days=REPORTING_DAYS.map((_,i)=>addDays(period.start,i));
  return products.map((p,index)=>{
    const daily=days.map((_,d)=> {
      if(index===0) return [0,1,1,1,1,2][d] || 0;
      if(index===1) return [0,4,8,12,6,4][d] || 0;
      if(index===2) return [0,0,1,0,0,0][d] || 0;
      return [0,0,1,0,1,1][d] || 0;
    });
    const total=daily.reduce((a,b)=>a+b,0);
    return {...p,initial:p.full_stock,daily,total,balance:Number(p.full_stock)-total};
  });
}


export async function getPeriodInitials(project,periodType,periodStart){
  if(!supabaseConfigured) return {};
  const {data,error}=await supabase.from('period_initials').select('product_id,initial_quantity')
    .eq('project_id',project.id).eq('period_type',periodType).eq('period_start',dateKey(periodStart));
  if(error) throw error;
  return Object.fromEntries((data||[]).map(x=>[x.product_id,Number(x.initial_quantity)]));
}

export async function savePeriodInitials(project,periodType,periodStart,values,adminId){
  if(!supabaseConfigured) return;
  const rows=Object.entries(values).map(([product_id,initial_quantity])=>({
    project_id:project.id,period_type:periodType,period_start:dateKey(periodStart),
    product_id,initial_quantity:Number(initial_quantity||0),edited_by:adminId
  }));
  const {error}=await supabase.from('period_initials').upsert(rows,{onConflict:'project_id,period_type,period_start,product_id'});
  if(error) throw error;
  await audit(project.id,adminId,`${periodType}.initials.edited`,`${periodType}_initials`,null,{periodStart:dateKey(periodStart),values});
}

export async function getWeeklyReportMatrix(project,period,products){
  if(!supabaseConfigured) return demoWeeklyUsage(products,period);
  const reports=await getReportsInRange(project,period.start,period.end);
  const overrides=await getPeriodInitials(project,'week',period.start);
  const byDate=Object.fromEntries(reports.map(r=>[r.report_date,r]));
  const prior=await getReportsInRange(project,addDays(period.start,-7),addDays(period.start,-2));
  const priorByProduct={};
  for(const r of prior) for(const u of (r.daily_usage||[])) priorByProduct[u.product_id]=(priorByProduct[u.product_id]||0)+Number(u.quantity||0);
  return products.map(p=>{
    const carried=Number(overrides[p.id] ?? (Number(p.full_stock||0)-Number(priorByProduct[p.id]||0)));
    const daily=REPORTING_DAYS.map((_,i)=>{
      const r=byDate[dateKey(addDays(period.start,i))];
      if(!r) return null;
      return Number((r.daily_usage||[]).find(u=>u.product_id===p.id)?.quantity||0);
    });
    const total=daily.reduce((a,b)=>a+(Number(b)||0),0);
    return {...p,initial:carried,daily,total,balance:carried-total,reportIds:Object.fromEntries(REPORTING_DAYS.map((_,i)=>[dateKey(addDays(period.start,i)),byDate[dateKey(addDays(period.start,i))]?.id||null]))};
  });
}

export async function getMonthlyReportMatrix(project,monthDate,products){
  const weeks=monthWeeks(monthDate.getFullYear(),monthDate.getMonth());
  const weekRows=[];
  for(const w of weeks) weekRows.push(await getWeeklyReportMatrix(project,w,products));
  const monthStart=new Date(monthDate.getFullYear(),monthDate.getMonth(),1);
  const overrides=await getPeriodInitials(project,'month',monthStart);
  let usageOverrides={};
  if(supabaseConfigured){
    const {data,error}=await supabase.from('monthly_usage_overrides').select('product_id,week_number,quantity')
      .eq('project_id',project.id).eq('month_start',dateKey(monthStart));
    if(error) throw error;
    usageOverrides={};
    for(const x of data||[]) usageOverrides[`${x.product_id}:${x.week_number}`]=Number(x.quantity);
  }
  return products.map((p,idx)=>{
    const initial=Number(overrides[p.id] ?? (weekRows[0]?.[idx]?.initial ?? p.full_stock ?? 0));
    const weekTotals=weekRows.map((rows,widx)=>Number(usageOverrides[`${p.id}:${widx+1}`] ?? rows[idx]?.total ?? 0));
    const total=weekTotals.reduce((a,b)=>a+b,0);
    return {...p,initial,weekTotals,total,balance:initial-total,weeks};
  });
}


export async function getCurrentBalances(project,products){
  if(!supabaseConfigured) return Object.fromEntries(products.map(p=>[p.id,Number(p.full_stock)]));
  const {data:reports,error}=await supabase.from('daily_reports').select('daily_usage(product_id,quantity)').eq('project_id',project.id);
  if(error) throw error;
  const used={};
  for(const r of reports||[]) for(const u of (r.daily_usage||[])) used[u.product_id]=(used[u.product_id]||0)+Number(u.quantity||0);
  const {data:adj,error:ae}=await supabase.from('stock_adjustments').select('product_id,quantity_delta').eq('project_id',project.id);
  if(ae) throw ae;
  const adjustments={};
  for(const a of adj||[]) adjustments[a.product_id]=(adjustments[a.product_id]||0)+Number(a.quantity_delta||0);
  return Object.fromEntries(products.map(p=>[p.id,Number(p.full_stock)-Number(used[p.id]||0)+Number(adjustments[p.id]||0)]));
}


export async function getMySubmissionStatus(project,date){
  if(!supabaseConfigured) return {submitted:false,submitted_at:null};
  const {data,error}=await supabase.rpc('my_submission_status',{p_project_id:project.id,p_report_date:date}).single();
  if(error) throw error;
  return data||{submitted:false};
}


export async function saveWeeklyMatrix(project,period,rows,adminId){
  if(!supabaseConfigured) return;
  for(const row of rows){
    const usageRows = REPORTING_DAYS.map((_,i)=>({product_id:row.id,quantity:Number(row.daily[i]||0)}));
    const byDay = Object.entries(row.reportIds||{});
    for(const [date,reportId] of byDay){
      if(reportId){
        const existing = await getReport(project,date);
        const merged=(existing?.daily_usage||[]).filter(u=>u.product_id!==row.id).map(u=>({product_id:u.product_id,quantity:u.quantity}));
        merged.push(usageRows[REPORTING_DAYS.findIndex((_,i)=>dateKey(addDays(period.start,i))===date)]);
        await updateDaily(project,reportId,adminId,merged);
      } else {
        const r=await getReport(project,date);
        if(!r){
          // Admin correction creates the missing day's report and records it in audit.
          const allProducts=await getProducts(project);
          await submitDaily(project,date,adminId,allProducts.map(p=>({
            product_id:p.id,
            quantity:p.id===row.id?Number(row.daily[REPORTING_DAYS.findIndex((_,i)=>dateKey(addDays(period.start,i))===date)]||0):0
          })));
        }
      }
    }
  }
  await savePeriodInitials(project,'week',period.start,Object.fromEntries(rows.map(r=>[r.id,r.initial])),adminId);
}


export async function saveMonthlyMatrix(project,monthDate,rows,adminId){
  if(!supabaseConfigured) return;
  const monthStart=new Date(monthDate.getFullYear(),monthDate.getMonth(),1);
  const payload=[];
  for(const r of rows) for(let i=0;i<4;i++) payload.push({
    project_id:project.id,month_start:dateKey(monthStart),product_id:r.id,week_number:i+1,
    quantity:Number(r.weekTotals[i]||0),edited_by:adminId
  });
  const {error}=await supabase.from('monthly_usage_overrides').upsert(payload,{onConflict:'project_id,month_start,product_id,week_number'});
  if(error) throw error;
  await savePeriodInitials(project,'month',monthStart,Object.fromEntries(rows.map(r=>[r.id,r.initial])),adminId);
  await audit(project.id,adminId,'month.usage.edited','monthly_usage',null,{monthStart:dateKey(monthStart)});
}
