import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { DsaDigitalAcceptanceScreen } from "@/components/screens/dsa-digital-acceptance-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DSA Digital Acceptance – Cosmos Bank",
  referrer: "no-referrer",
};

// Explicit viewport export ensures mobile browsers render at device width
// and prevents Android Chrome/Gmail webview from using a desktop viewport
// (which was causing the WAF to see a desktop UA and differ from mobile).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function DsaDigitalAcceptancePage({ params }: PageProps) {
  const resolvedParams = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-xs">
          Loading acceptance portal...
        </div>
      }
    >
      <DsaDigitalAcceptanceScreen token={resolvedParams.token} />
    </Suspense>
  );
}
