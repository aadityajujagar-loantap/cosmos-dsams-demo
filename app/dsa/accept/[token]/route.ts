import { NextRequest, NextResponse } from "next/server";

/**
 * GET /dsa/accept/[token]
 *
 * WAF-safe mobile redirect shim.
 *
 * Gmail / Android webview sets Referer to "android-app://com.google.android.gm"
 * which the F5 WAF flags as an evasion technique (URL with multiple slashes).
 * The email link points here instead of directly to /dsa/digital-acceptance/[token].
 * This Next.js route handler issues a 302 with Referrer-Policy: no-referrer so
 * the subsequent page load carries no problematic Referer header.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params;
  const destination = `/dsa/digital-acceptance/${token}`;

  return NextResponse.redirect(new URL(destination, _request.url), {
    status: 302,
    headers: {
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store, no-cache",
    },
  });
}

