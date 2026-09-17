import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token") || "";
  const acceptHeader = request.headers.get("accept") || "";

  // If request is from browser navigation (HTML), redirect to the frontend verification screen
  if (acceptHeader.includes("text/html") || !acceptHeader.includes("application/json")) {
    const targetUrl = new URL("/verify-email", request.url);
    if (token) targetUrl.searchParams.set("token", token);
    targetUrl.searchParams.set("type", "loan");
    return NextResponse.redirect(targetUrl, { status: 307 });
  }

  // If JSON request (e.g. API client, cURL, automated tests)
  if (!token) {
    return NextResponse.json(
      {
        status: "error",
        data: {
          status: "error",
          status_code: 422,
          message: "Verification token is required.",
          errors: { token: "Token parameter is missing." },
        },
      },
      { status: 422 }
    );
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const res = await fetch(`${backendUrl}/v1/loan/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Tenant-ID": "cosmos-bank",
        "X-API-Token": process.env.NEXT_PUBLIC_LOAN_JOURNEY_API_TOKEN || "ijkyWTMMuVWqDaGJFiEWQd2jogOuvO8QdkDBMWUG882HXQPvqg2StcydbAUiNH4J",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Connection refused to backend API.";
    return NextResponse.json(
      {
        status: "error",
        data: {
          status: "error",
          status_code: 500,
          message: "Unable to proxy verification request to backend service.",
          errors: { exception: errMessage },
        },
      },
      { status: 500 }
    );
  }
}
