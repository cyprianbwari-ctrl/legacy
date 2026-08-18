# Stock Control v5 — Clean Redo

This is the v5 architecture rebuilt without changing the agreed visual design.

## Replace these files in the existing v5 project

Copy these files over the same paths in your current `legacy` folder:

- `src/AppContext.jsx`
- `src/pages/AuthGate.jsx`
- `src/main.jsx`
- `src/layouts/AppLayout.jsx`
- `src/services/api.js`
- `src/lib/supabase.js`
- `src/lib/periods.js`
- `src/pages/home/Home.jsx`
- `src/pages/usage/Daily.jsx`
- `src/pages/usage/Weekly.jsx`
- `src/pages/usage/Monthly.jsx`
- `src/pages/admin/Users.jsx`
- `src/pages/staff/Staff.jsx`
- `src/pages/inventory/Products.jsx`
- `supabase/schema.sql`
- `supabase/functions/admin-user/index.ts`

The existing visual components and `src/styles/global.css` remain the v5 design.

## Important authentication change

The app NO LONGER calls `supabase.auth.signUp()` for the first Super Admin.

That was the source of the repeated "email rate limit exceeded" problem.

Instead:

1. Create exactly one Auth user in Supabase Authentication > Users.
2. Use the email you created there to sign in through the Admin login.
3. If the Auth user has no application profile yet, the app automatically opens "Finish Super Admin Setup".
4. That step links the existing Auth user to the existing Heritage Legacy / Heritage Housekeeping records instead of creating duplicates.

## Database

Run the new `supabase/schema.sql` in the Supabase SQL Editor.

It is designed to preserve an existing Heritage Legacy / Heritage Housekeeping company/project when the first Super Admin is linked.

## Admin / Staff account creation

Deploy the Edge Function at:

`supabase/functions/admin-user/index.ts`

This function creates and manages Auth users using the Supabase server key, which must never be placed in the React `.env`.

## Security changes

- Admin/Staff selection happens before login.
- The actual account role is checked after login.
- Staff can access Daily only.
- Weekly, Monthly, Trends, Inventory, Staff management and Admin are manager-only.
- Staff cannot read submitted report quantities.
- Only Admin/Super Admin can read or edit submitted reports.
- Only one report can exist for a project/day.
- Friday is rejected at database level.
- Staff deletion from a project is a soft removal of project membership so history remains.
- Weekly and monthly Admin changes are written in transactions and audited.

## Current project data

Do not run a product seed that creates duplicates if the 12 products are already in the project. The Products page can import/export CSV, but existing records should be left in place.

## V5 Step 3 — Audit Trail

The Administration → Audit page now includes permanent project-scoped audit history with filters for:
- date range
- actor/admin
- action
- product
- staff
- free-text search

Exports are available as CSV, Excel (.xlsx), and PDF. Install dependencies with `npm install` before running the app.

The database keeps `audit_logs` manager-readable and does not expose update/delete policies, so audit records are not editable through the application.
