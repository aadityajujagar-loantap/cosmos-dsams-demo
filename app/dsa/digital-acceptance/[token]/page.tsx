import { Suspense } from "react";
import { DsaDigitalAcceptanceScreen } from "@/components/screens/dsa-digital-acceptance-screen";

export const dynamic = "force-dynamic";

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
