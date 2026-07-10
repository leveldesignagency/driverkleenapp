# kleen-contractor — Vercel environment variables

Set these on the **kleen-contractor** Vercel project (contractor.kleenapp.co.uk).

## Required after driver → contractor domain change

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_SITE_URL` | `https://contractor.kleenapp.co.uk` |
| `NEXT_PUBLIC_CUSTOMER_APP_URL` | `https://dashboard.kleenapp.co.uk` |
| `NEXT_PUBLIC_MARKETING_URL` | `https://www.kleenapp.co.uk` |
| **`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`** | **Leave unset** on kleen-contractor (do not share cookies with kleen-app — causes Google PKCE failures) |
| **`SUPABASE_SERVICE_ROLE_KEY`** | **Required** — promotes Google sign-ups from customer → contractor after login |

Without **`SUPABASE_SERVICE_ROLE_KEY`**, Google sign-in succeeds but users loop back to the join page (403 / role upgrade failure).

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
