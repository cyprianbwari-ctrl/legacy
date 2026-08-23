# Staff creation troubleshooting

The Staff page calls the Supabase Edge Function `admin-user`.

Deploy it to the SAME Supabase project used by the app:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-user
```

If the page displays an error after pressing Confirm & Create, use that exact message to diagnose the Supabase function/database configuration.

The function requires the server-side `SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides automatically to Edge Functions. Do NOT put this key in VITE_* variables.
