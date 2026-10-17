import { NextResponse } from "next/server";
import { saveSurvey } from "@/lib/storage";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanSurvey } from "@/lib/validation";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  if (!rateLimit(`survey:${clientKey(req)}`, 10)) {
    return NextResponse.json({ status: "error", message: "Too many attempts. Please try again shortly." }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const answers = cleanSurvey(body.answers);
  if (!answers.interest && !answers.intent && !answers.price && !answers.role && !answers.concern) {
    return NextResponse.json({ status: "error", message: "Choose at least one answer, or skip." }, { status: 422 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!UUID_RE.test(token)) {
    // No token: either demo mode or an invalid request. Let storage decide for demo.
    const res = await saveSurvey("00000000-0000-0000-0000-000000000000", answers);
    if (res.status === "demo") return NextResponse.json({ status: "demo" });
    return NextResponse.json({ status: "error", message: "This survey link has expired." }, { status: 400 });
  }

  const result = await saveSurvey(token, answers);
  switch (result.status) {
    case "saved":
      return NextResponse.json({ status: "saved" });
    case "demo":
      return NextResponse.json({ status: "demo" });
    case "not_found":
      return NextResponse.json({ status: "error", message: "These answers were already submitted." }, { status: 409 });
    default:
      return NextResponse.json({ status: "error", message: result.message }, { status: 502 });
  }
}
