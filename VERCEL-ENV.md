# kleen-contractor — Vercel environment variables

Set these on the **kleen-contractor** Vercel project (contractor.kleenapp.co.uk).

## Required after driver → contractor domain change

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_SITE_URL` | `https://contractor.kleenapp.co.uk` |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` | `https://dashboard.kleenapp.co.uk` |
| `NEXT_PUBLIC_MARKETING_URL` | `https://www.kleenapp.co.uk` |
| `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` | `.kleenapp.co.uk` (same value on kleen-app + kleen-admin) |

**Do not** leave `NEXT_PUBLIC_SITE_URL` as `https://driver.kleenapp.co.uk` or `https://dashboard.kleenapp.co.uk` — Google OAuth will send users to the wrong host and they will land on the marketing/customer site without a contractor session.

## Supabase (Authentication → URL configuration)

Add redirect URLs:

- `https://contractor.kleenapp.co.uk/**`
- `https://driver.kleenapp.co.uk/**` (optional, legacy redirect)

## Google Cloud Console

**Authorized JavaScript origins:**

- `https://contractor.kleenapp.co.uk`

## kleen-app (marketing links)

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_CONTRACTOR_PORTAL_URL` | `https://contractor.kleenapp.co.uk` |

Redeploy **both** projects after changing env vars.
