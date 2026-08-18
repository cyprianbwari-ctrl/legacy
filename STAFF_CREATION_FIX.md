# Staff creation fix — V5

This patch fixes Admin → Staff account creation.

## 1. Install and run the app

```bash
npm install
npm run dev
```

## 2. Deploy the required Supabase Edge Function

The Staff page creates Auth accounts securely through the `admin-user` Edge Function. The browser must NOT receive the Supabase service-role key.

From the project folder, after installing/login to the Supabase CLI and linking this project:

```bash
supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
supabase functions deploy admin-user
```

If the CLI asks for database credentials, use the credentials for the same Supabase project shown in the dashboard.

## 3. Confirm the function is deployed

In Supabase Dashboard → Edge Functions, there must be an `admin-user` function.

The function uses the currently signed-in user's access token and performs the protected Auth/profile/membership work server-side.

## 4. Create staff

Sign in as an Admin or Super Admin:

**Admin → Staff → Add Staff**

Enter:
- Full name
- Username
- Password (minimum 8 characters)

Then:
**Confirm & Create**

The account is created with:
- Auth email: `username@stock.local`
- application role: `staff`
- active profile
- active membership in the selected project

The function also returns a specific error when Auth creation, profile creation, or project membership fails.

## Important

Do not put `SUPABASE_SERVICE_ROLE_KEY` in `.env`, Vite, React, or any `VITE_*` variable. It belongs only in the Supabase Edge Function environment.
