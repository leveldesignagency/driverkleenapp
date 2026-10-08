import { NextRequest, NextResponse } from "next/server";
import { checkPostcodeIsKent } from "@/lib/service-area-kent";

export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode") || "";
  const result = await checkPostcodeIsKent(postcode);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, postcode: result.postcode }, { status: 400 });
  }
  return NextResponse.json({
    inKent: result.inKent,
    postcode: result.postcode,
    areaLabel: result.areaLabel,
  });
}

export async function POST(request: NextRequest) {
  let body: { postcode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await checkPostcodeIsKent(body.postcode || "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error, postcode: result.postcode }, { status: 400 });
  }
  return NextResponse.json({
    inKent: result.inKent,
    postcode: result.postcode,
    areaLabel: result.areaLabel,
  });
}
