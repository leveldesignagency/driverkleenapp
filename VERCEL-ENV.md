# Vercel deployment — build settings & environment variables

## Fix for: “No Output Directory named `public` found”

This happens when **Output Directory** is set in Vercel for a **Next.js** app. Next.js does not publish a static site into `public/` after `next build`.

1. Open **Vercel** → your project **driverkleenapp** → **Settings** → **General** (or **Build & Development Settings**).
2. Find **Output Directory** (or **Build Output**).
3. **Clear it completely** (leave **empty**). Do **not** use `public`, `dist`, or `.next` here.
4. **Framework Preset** should be **Next.js** (or leave **Other** with nothing overriding output).
5. **Root directory:** leave `.` if the repo root is this app.
6. Save and **Redeploy**.

Optional: the repo includes `vercel.json` with `framework: "nextjs"` so Vercel treats this as a Next app.

---

## Build settings (reference)

| Setting | Value |
|--------|--------|
| Framework | Next.js |
| Build command | `npm run build` |
| Install command | `npm install` |
| Output directory | *(empty / not set)* |
| Node.js | 20.x recommended |

---

## Environment variables (set in Vercel → **Settings** → **Environment Variables**)

Add each name below for **Production** (and Preview/Development if you use them).

> **Security:** never commit real API keys to Git. Use Vercel’s dashboard or a **local-only** file that is in `.gitignore` (e.g. `VERCEL-ENV-LOCAL.md` — see end of this file).

| Name | Value (you fill in) | Notes |
|------|---------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` (anon, public) | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` (service role, **secret**) | Server only; same page — **do not** expose to browser |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` or your custom domain | This **contractor** deployment URL, no trailing `/` |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` | `https://dashboard.kleenapp.co.uk` (or your dashboard URL) | Customer app; used for “Customer sign in” links |
| `NEXT_PUBLIC_MARKETING_URL` | `https://www.kleenapp.co.uk` | Optional; sign-out / marketing home |
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | Stripe Connect onboarding API |
| `RESEND_API_KEY` | `re_...` | If you use “on route” emails from the field API; optional in dev |
| `RESEND_FORCE_ONBOARDING` | `true` or `false` | Match kleen-app if using Resend |
| `RESEND_FROM_VERIFIED` | `true` or `false` | When domain verified in Resend |
| `RESEND_FROM_EMAIL` | `Kleen <info@kleenapp.co.uk>` | If verified |
| `RESEND_REPLY_TO` | your reply email | Optional |
| `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` | e.g. `.kleenapp.co.uk` | **Optional**; only if sharing cookies with www + dashboard (same as other apps) |

**Supabase:** add your Vercel URL(s) under **Authentication → URL configuration** → **Redirect URLs**, including  
`https://<this-app-host>/auth/callback`.

---

## “Actual keys” — keep them private

- Paste real values **only** in the Vercel UI (or 1Password / team secrets).
- To keep a private copy on disk, copy this file to `VERCEL-ENV-LOCAL.md` (it is **gitignored**), paste your real keys there, and **never** commit that file.

```bash
# From kleen-contractor/ (local only, not in git)
cp VERCEL-ENV.md VERCEL-ENV-LOCAL.md
# Edit VERCEL-ENV-LOCAL.md and replace placeholders with your keys
```

---

## Cross-app env (for consistency, not in this repo)

- **kleen-app:** `NEXT_PUBLIC_CONTRACTOR_PORTAL_URL` = this Vercel deployment URL (so `/contractor` redirects).
- **kleen-admin:** `CONTRACTOR_PORTAL_BASE_URL` = same URL (contractor email links).
