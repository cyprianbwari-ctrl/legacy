# Stock Control Management

React + Vite + Supabase inventory and daily consumption management application.

## Run

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Add your Supabase URL and anon key.
4. Run `npm install`.
5. Run `npm run dev`.

## Supabase

Open `supabase/schema.sql` in the Supabase SQL editor and run it.

Then create the first Super Admin using the SQL/RPC instructions at the bottom of the schema.

## Included

- Role gate before login: Admin / Staff
- Supabase authentication
- Home dashboard
- Daily usage
- Weekly usage, Saturday–Thursday
- Monthly usage with four reporting weeks
- Trends
- Products
- Stock adjustments
- Staff
- Assignments
- Audit log
- CSV import/export
- Confirmation before Admin edits
- Low-stock and order-point status
- Legacy checklist product seed


## Supabase setup details

1. Create a Supabase project.
2. In Authentication settings, disable email confirmation if you want the username/password setup flow to create the first Super Admin immediately. The app intentionally uses an internal email alias (`username@stock.local`) so users can sign in with usernames.
3. Run `supabase/schema.sql`.
4. Deploy the Edge Function:
   `supabase functions deploy create-user`
5. The Edge Function uses the built-in `SUPABASE_SERVICE_ROLE_KEY` only inside Supabase; never put the service role key in the Vite `.env`.
6. Put the project URL and anon key in `.env`.
7. Start the app.

## Legacy checklist

The photographed checklist is included at:

- `public/reference/daily_consumption_checklist_source.jpg`
- `public/data/legacy_products.csv`
- `public/data/legacy_checklist_raw.csv`

The product CSV normalizes the two clearly convertible mixed quantities:
- Toilet rolls: 12 cases + 4 rolls = 148 rolls, with 1 case = 12 packs and 1 pack = 10 rolls.
- Ecofresh facial tissue: 37 cases + 29 packets = 1,139 packets, with 1 case = 30 packets.

Other handwritten quantities that are ambiguous are marked for Admin verification rather than being silently guessed.

## Important

Before putting real data into production, change the demo fallback behaviour in the UI only after Supabase is configured and test:
- staff cannot read submitted quantities,
- staff cannot edit submitted reports,
- only one report can exist per project/day,
- Friday submissions are rejected,
- Admin weekly/monthly corrections are audited,
- RLS blocks direct unauthorized access.
