import { NextResponse } from "next/server";
import { saveSurvey, storageMode, storageUnavailable } from "@/lib/storage";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanSurvey } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!rateLimit(`survey:${clientKey(req)}`, 10)) {
    return NextResponse.json({ status: "error", message: "Too many attempts. Please try again shortly." }, { status: 429 });
  }
  const parsed = await readJsonObject(req);
  if (parsed.response) return parsed.response;
  const { body } = parsed;

  const answers = cleanSurvey(body.answers);
  if (!answers.interest && !answers.intent && !answers.price && !answers.role && !answers.concern) {
    return NextResponse.json({ status: "error", message: "Choose at least one answer, or skip." }, { status: 422 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!UUID_RE.test(token)) {
    if (storageMode() === "demo" && !storageUnavailable()) return NextResponse.json({ status: "demo" });
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
    case "unavailable":
      return NextResponse.json({ status: "error", message: result.message }, { status: 503 });
    default:
      return NextResponse.json({ status: "error", message: result.message }, { status: 502 });
  }
}
