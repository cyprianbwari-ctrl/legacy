import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization.');

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated.');

    const { data: actor } = await userClient.from('profiles').select('id,role,active').eq('id', user.id).single();
    if (!actor?.active || !['admin','super_admin'].includes(actor.role)) throw new Error('Not authorized.');

    const body = await req.json();
    const { full_name, username, password, role='staff', project_id } = body;
    if (!full_name || !username || !password || !project_id) throw new Error('Full name, username, password and project are required.');
    if (role === 'admin' && actor.role !== 'super_admin') throw new Error('Only Super Admin can create Admin accounts.');

    const admin = createClient(supabaseUrl, serviceKey);
    const email = `${String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@stock.local`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name, username }
    });
    if (createError) throw createError;

    const { error: profileError } = await admin.from('profiles').insert({
      id: created.user.id, full_name, username, role, active: true
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    const { error: memberError } = await admin.from('project_memberships').insert({
      project_id, user_id: created.user.id
    });
    if (memberError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw memberError;
    }

    await admin.from('audit_logs').insert({
      project_id, actor_id: user.id, action: role==='admin'?'admin.created':'staff.created',
      entity_type:'profile', entity_id:created.user.id, details:{full_name,username,role}
    });

    return new Response(JSON.stringify({ ok:true, user_id:created.user.id }), { headers:{...cors,'Content-Type':'application/json'} });
  } catch (e) {
    return new Response(JSON.stringify({ error:e.message||String(e) }), { status:400, headers:{...cors,'Content-Type':'application/json'} });
  }
});
