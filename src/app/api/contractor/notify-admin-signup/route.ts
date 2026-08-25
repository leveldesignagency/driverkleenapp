import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendAdminContractorSignupEmail } from "@/lib/resend-admin-notify";
import { sendContractorWelcomeEmail } from "@/lib/resend-contractor-lifecycle";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (profile?.role !== "operative") {
    return NextResponse.json({ error: "Contractor account required" }, { status: 403 });
  }

  const { data: operative } = await supabase.from("operatives").select("id, full_name, email").eq("user_id", user.id).single();
  if (!operative) {
    return NextResponse.json({ error: "Contractor profile not found" }, { status: 404 });
  }

  const fullName = String(operative.full_name || profile.full_name || "Contractor");
  const email = String(operative.email || profile.email || user.email || "").trim();

  const result = await sendAdminContractorSignupEmail({
    operativeId: String(operative.id),
    fullName,
    email,
  });

  if (email && !user.user_metadata?.welcome_email_sent_at) {
    const welcome = await sendContractorWelcomeEmail({ toEmail: email, fullName });
    if (welcome.ok) {
      try {
        const admin = createServiceRoleClient();
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            welcome_email_sent_at: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.error("notify-admin-signup welcome metadata:", e);
      }
    }
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Email not sent" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
