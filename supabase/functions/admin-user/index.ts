import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type Role = 'admin' | 'staff';
type Action = 'create' | 'update' | 'remove_from_project' | 'restore_membership' | 'set_password';
type RequestBody = {
  action: Action;
  role: Role;
  project_id: string;
  user_id?: string;
  full_name?: string;
  username?: string;
  password?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function cleanUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Supabase server configuration is incomplete. Deploy the function with the project service role available.' }, 500);
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Missing authorization token. Please sign in again.' }, 401);

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: `Your Supabase session is not valid. ${authError?.message || ''}`.trim() }, 401);
    }

    const caller = authData.user;
    const body = (await req.json()) as RequestBody;

    if (!body.action || !body.role || !body.project_id) {
      return json({ error: 'Action, role and project are required.' }, 400);
    }

    const { data: callerProfile, error: callerProfileError } = await db
      .from('profiles')
      .select('id,role,active,full_name,username')
      .eq('id', caller.id)
      .maybeSingle();

    if (callerProfileError) {
      return json({ error: `Could not read your application profile: ${callerProfileError.message}` }, 403);
    }
    if (!callerProfile?.active) {
      return json({ error: 'Your application account is not active.' }, 403);
    }
    if (!['admin', 'super_admin'].includes(callerProfile.role)) {
      return json({ error: 'Only Admin or Super Admin can manage staff.' }, 403);
    }
    if (body.role === 'admin' && callerProfile.role !== 'super_admin') {
      return json({ error: 'Only Super Admin can manage Admin accounts.' }, 403);
    }

    // A Super Admin may manage any project that belongs to a company in which
    // they have an active membership. Admins must be an active member of the
    // selected project. This avoids false 403s caused by a stale membership row.
    const { data: targetProject, error: projectError } = await db
      .from('projects')
      .select('id,company_id,name')
      .eq('id', body.project_id)
      .maybeSingle();

    if (projectError || !targetProject) {
      return json({ error: `The selected project could not be found. ${projectError?.message || ''}`.trim() }, 404);
    }

    let hasAccess = false;
    if (callerProfile.role === 'super_admin') {
      const { data: membership } = await db
        .from('project_memberships')
        .select('id,active')
        .eq('project_id', body.project_id)
        .eq('user_id', caller.id)
        .maybeSingle();
      hasAccess = Boolean(membership?.active);

      // Repair a missing Super Admin membership for a project in their company.
      if (!hasAccess) {
        const { data: companyMembership } = await db
          .from('project_memberships')
          .select('id,active,projects!inner(company_id)')
          .eq('user_id', caller.id)
          .eq('active', true)
          .eq('projects.company_id', targetProject.company_id)
          .limit(1)
          .maybeSingle();
        if (companyMembership) {
          const { error: repairError } = await db
            .from('project_memberships')
            .upsert({ project_id: body.project_id, user_id: caller.id, active: true }, { onConflict: 'project_id,user_id' });
          hasAccess = !repairError;
        }
      }
    } else {
      const { data: membership } = await db
        .from('project_memberships')
        .select('id,active')
        .eq('project_id', body.project_id)
        .eq('user_id', caller.id)
        .maybeSingle();
      hasAccess = Boolean(membership?.active);
    }

    if (!hasAccess) {
      return json({ error: `You do not have management access to project "${targetProject.name}".` }, 403);
    }

    if (body.action === 'create') {
      const fullName = body.full_name?.trim() || '';
      const username = cleanUsername(body.username || '');
      const password = body.password || '';

      if (!fullName || !username || !password) {
        return json({ error: 'Full name, username and password are required.' }, 400);
      }
      if (username.length < 2) return json({ error: 'Username must contain at least 2 valid characters.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

      const email = `${username}@stock.local`;
      let targetUserId: string | null = null;

      const { data: existingProfile, error: profileLookupError } = await db
        .from('profiles')
        .select('id,role')
        .eq('username', username)
        .maybeSingle();
      if (profileLookupError) return json({ error: `Could not check the username: ${profileLookupError.message}` }, 400);
      if (existingProfile?.id) targetUserId = existingProfile.id;

      if (!targetUserId) {
        const { data: existingAuth, error: listError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) return json({ error: `Could not check existing Auth accounts: ${listError.message}` }, 400);
        const match = existingAuth.users.find((u) => u.email?.toLowerCase() === email);
        if (match) targetUserId = match.id;
      }

      if (!targetUserId) {
        const { data: created, error: createError } = await db.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, username, app_role: body.role }
        });
        if (createError || !created.user) {
          return json({ error: `Unable to create the Staff Auth account: ${createError?.message || 'unknown error'}` }, 400);
        }
        targetUserId = created.user.id;
      } else {
        const { data: existingTarget } = await db
          .from('profiles')
          .select('id,role')
          .eq('id', targetUserId)
          .maybeSingle();

        if (existingTarget && existingTarget.role !== body.role && existingTarget.role !== 'staff') {
          return json({ error: `Username "${username}" already belongs to a ${existingTarget.role.replace('_', ' ')} account.` }, 409);
        }

        const { error: passwordError } = await db.auth.admin.updateUserById(targetUserId, {
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, username, app_role: body.role }
        });
        if (passwordError) return json({ error: `The existing Auth account could not be updated: ${passwordError.message}` }, 400);
      }

      const { error: saveProfileError } = await db.from('profiles').upsert({
        id: targetUserId,
        full_name: fullName,
        username,
        role: body.role,
        active: true
      }, { onConflict: 'id' });
      if (saveProfileError) return json({ error: `Auth account was created, but the application profile could not be saved: ${saveProfileError.message}` }, 400);

      const { data: membership, error: membershipError } = await db.from('project_memberships').upsert({
        project_id: body.project_id,
        user_id: targetUserId,
        active: true
      }, { onConflict: 'project_id,user_id' }).select('id').single();
      if (membershipError) return json({ error: `Staff account was created, but project access could not be saved: ${membershipError.message}` }, 400);

      const { error: auditError } = await db.from('audit_logs').insert({
        project_id: body.project_id,
        actor_id: caller.id,
        action: body.role === 'admin' ? 'admin.created' : 'staff.created',
        entity_type: 'profile',
        entity_id: targetUserId,
        details: { username, full_name: fullName, user_id: targetUserId, staff_name: body.role === 'staff' ? fullName : undefined, role: body.role }
      });

      return json({ ok: true, user_id: targetUserId, membership_id: membership.id, audit_warning: auditError?.message || null });
    }

    if (!body.user_id) return json({ error: 'User ID is required.' }, 400);

    if (body.action === 'update') {
      const updateProfile: Record<string, string | boolean> = {};
      if (body.full_name?.trim()) updateProfile.full_name = body.full_name.trim();
      if (body.username?.trim()) updateProfile.username = cleanUsername(body.username);
      if (Object.keys(updateProfile).length) {
        const { error } = await db.from('profiles').update(updateProfile).eq('id', body.user_id);
        if (error) return json({ error: `Could not update the profile: ${error.message}` }, 400);
      }
      if (body.password) {
        if (body.password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
        const { error } = await db.auth.admin.updateUserById(body.user_id, { password: body.password });
        if (error) return json({ error: `Could not update the password: ${error.message}` }, 400);
      }
      await db.from('audit_logs').insert({ project_id: body.project_id, actor_id: caller.id, action: `${body.role}.updated`, entity_type: 'profile', entity_id: body.user_id, details: { ...updateProfile, user_id: body.user_id, role: body.role } });
      return json({ ok: true });
    }

    if (body.action === 'remove_from_project' || body.action === 'restore_membership') {
      const active = body.action === 'restore_membership';
      const { data: targetProfile } = await db.from('profiles').select('full_name,username,role').eq('id', body.user_id).maybeSingle();
      const { error } = await db.from('project_memberships').upsert({ project_id: body.project_id, user_id: body.user_id, active }, { onConflict: 'project_id,user_id' });
      if (error) return json({ error: `Could not change project access: ${error.message}` }, 400);
      await db.from('audit_logs').insert({ project_id: body.project_id, actor_id: caller.id, action: active ? `${body.role}.restored_to_project` : `${body.role}.removed_from_project`, entity_type: 'project_membership', entity_id: body.user_id, details: { user_id: body.user_id, full_name: targetProfile?.full_name || '', username: targetProfile?.username || '', role: body.role } });
      return json({ ok: true });
    }

    if (body.action === 'set_password') {
      if (!body.password) return json({ error: 'New password is required.' }, 400);
      if (body.password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      const { error } = await db.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) return json({ error: `Could not reset the password: ${error.message}` }, 400);
      await db.from('audit_logs').insert({ project_id: body.project_id, actor_id: caller.id, action: `${body.role}.password_reset`, entity_type: 'profile', entity_id: body.user_id, details: {} });
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${body.action}` }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) || 'Unexpected server error.' }, 500);
  }
});
