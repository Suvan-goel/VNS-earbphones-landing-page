import { cookies } from "next/headers";
import { reservationConfirmationPdf } from "@/lib/reservation-confirmation-pdf";
import { reservationConfirmationText } from "@/lib/reservation-confirmation";
import { reservationReceiptCookie, resolveReservationReceipt, validReservationReceiptHandle } from "@/lib/reservation-receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "text/plain; charset=utf-8",
};

function problem(message: string, status: number): Response {
  return new Response(message, { status, headers: privateHeaders });
}

/** The existing receipt cookie is scoped to /reserve/complete, including this route. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const handles = params.getAll("receipt");
  const formats = params.getAll("format");
  if (handles.length !== 1 || !validReservationReceiptHandle(handles[0])
    || formats.length > 1 || (formats.length === 1 && formats[0] !== "terms")
    || [...params.keys()].some((key) => key !== "receipt" && key !== "format")) {
    return problem("Open your reservation confirmation page to download your record.", 404);
  }
  const handle = handles[0];
  const session = (await cookies()).get(reservationReceiptCookie(handle))?.value;
  const outcome = await resolveReservationReceipt(session, handle);
  if (outcome.kind === "unavailable") return problem("Your reservation record is temporarily unavailable. Please try again shortly.", 503);
  if (outcome.kind === "missing") return problem("Your saved confirmation is unavailable. Use the browser you paid in, or contact support.", 404);
  if (!("row" in outcome)) return problem("Your reservation record is unavailable. Please contact support.", 404);
  if (!["paid", "partially_refunded", "refunded", "refund_review"].includes(outcome.kind)) {
    return problem("There is no confirmed payment to download yet. Check your reservation status before trying again.", 409);
  }
  const row = outcome.row;
  if (!Number.isSafeInteger(row.amount) || row.amount <= 0 || !Number.isSafeInteger(row.amount_refunded)
    || row.amount_refunded < 0 || row.amount_refunded > row.amount || !/^(gbp|usd)$/.test(row.currency)) {
    return problem("We could not confirm the payment details. Contact support for your reservation record.", 503);
  }
  if (formats[0] === "terms") {
    return new Response(reservationConfirmationText(row), {
      status: 200,
      headers: { ...privateHeaders, "Content-Disposition": 'attachment; filename="cymba-recorded-terms.txt"' },
    });
  }
  return new Response(new Uint8Array(await reservationConfirmationPdf(row)), {
    status: 200,
    headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="cymba-reservation-confirmation.pdf"' },
  });
}
