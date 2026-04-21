import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

/**
 * Starts or resumes Stripe Connect Express onboarding for the signed-in operative.
 * Saves stripe_account_id on operatives (service role) after account creation.
 */
export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const cookieStore = cookies();
  const cookieOpts = getSupabaseAuthCookieOptions();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOpts ? { cookieOptions: cookieOpts } : {}),
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "operative") {
    return NextResponse.json({ error: "Contractor account required" }, { status: 403 });
  }

  const { data: op, error: opErr } = await supabaseAuth
    .from("operatives")
    .select("id, stripe_account_id, email, full_name, is_active, is_verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (opErr || !op) {
    return NextResponse.json(
      { error: "Complete your contractor profile setup first (reload the contractor portal)." },
      { status: 400 }
    );
  }

  if (op.is_active === false) {
    return NextResponse.json({ error: "This contractor account is deactivated." }, { status: 403 });
  }

  if (!op.is_verified) {
    return NextResponse.json(
      {
        error:
          "Your contractor account must be verified by Kleen before you can connect Stripe. Complete your profile and wait for approval.",
      },
      { status: 403 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const siteBase =
    (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  let accountId = (op.stripe_account_id || "").trim();

  if (accountId) {
    const existing = await stripe.accounts.retrieve(accountId);
    if (existing.type === "custom") {
      const login = await stripe.accounts.createLoginLink(accountId);
      return NextResponse.json({ url: login.url });
    }
  }

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: op.email || user.email || undefined,
      metadata: { operative_id: op.id },
      capabilities: {
        transfers: { requested: true },
      },
      business_profile: {
        name: op.full_name?.slice(0, 100) || undefined,
        product_description: "Cleaning and property services via Kleen",
      },
    });
    accountId = account.id;

    const service = createServiceRoleClient();
    const { error: upErr } = await service
      .from("operatives")
      .update({ stripe_account_id: accountId })
      .eq("id", op.id);
    if (upErr) {
      console.error("connect-account-link: failed to save stripe_account_id", upErr);
      return NextResponse.json(
        { error: "Stripe account was created but saving the link failed. Contact support with your email." },
        { status: 500 }
      );
    }
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${siteBase}/contractor/payouts?stripe_refresh=1`,
    return_url: `${siteBase}/contractor/payouts?stripe_return=1`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
