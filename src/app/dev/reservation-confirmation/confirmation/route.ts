import { reservationConfirmationPdf } from "@/lib/reservation-confirmation-pdf";
import { reservationConfirmationText } from "@/lib/reservation-confirmation";
import { previewOutcome } from "../fixtures";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const outcome = previewOutcome(query.get("state") ?? undefined, query.get("market") ?? undefined, query.get("benefits") ?? undefined);
  if (!("row" in outcome) || !["paid", "partially_refunded", "refunded", "refund_review"].includes(outcome.kind)) return new Response(null, { status: 404 });
  const terms = query.get("format") === "terms";
  return new Response(terms ? reservationConfirmationText(outcome.row) : new Uint8Array(await reservationConfirmationPdf(outcome.row)), { headers: {
    "Content-Type": terms ? "text/plain; charset=utf-8" : "application/pdf",
    "Content-Disposition": terms ? 'attachment; filename="cymba-sample-recorded-terms.txt"' : 'attachment; filename="cymba-sample-confirmation.pdf"',
    "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  } });
}
