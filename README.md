# Kleen — Contractor portal (`driverkleenapp`)

Next.js app for Kleen contractors (profile, jobs, Stripe Connect, disputes). Uses the **same Supabase project** as the customer app.

## Vercel

1. Create or open project **driverkleenapp** → **Import** this repository ([driverkleenapp on GitHub](https://github.com/leveldesignagency/driverkleenapp)).
2. **Framework preset:** Next.js (auto). **Root directory:** `.` (repository root should be this app).
3. **Build:** `npm run build` · **Output:** default (`.next`).
4. Add environment variables from [`.env.local.example`](./.env.local.example) (production values for Supabase, Stripe, Resend, and public URLs).

Production URLs to set:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | This deployment’s origin (e.g. `https://contractors.kleenapp.co.uk`) |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` | Customer dashboard (e.g. `https://dashboard.kleenapp.co.uk`) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as customer app |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (auth callback profile upgrade) |
| `STRIPE_SECRET_KEY` | Connect onboarding |
| `RESEND_API_KEY` | Optional; job “en route” customer email from API route |

In **Supabase → Authentication → URL configuration**, add this site’s origin and `https://<your-host>/auth/callback` to **Redirect URLs**.

## Local dev

```bash
npm install
cp .env.local.example .env.local
# fill in values
npm run dev
```

App listens on **http://localhost:3101** by default.
