import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { token } = await params;
  const acceptHeader = request.headers.get("accept") || "";

  if (acceptHeader.includes("text/html") || !acceptHeader.includes("application/json")) {
    const targetUrl = new URL(`/dsa/verify-email/${token}`, request.url);
    return NextResponse.redirect(targetUrl, { status: 307 });
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const res = await fetch(`${backendUrl}/v1/dsa/verify-email/${encodeURIComponent(token)}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Failed to connect to backend DSA verification service.";
    return NextResponse.json(
      {
        status: false,
        message: errMessage,
      },
      { status: 500 }
    );
  }
}
