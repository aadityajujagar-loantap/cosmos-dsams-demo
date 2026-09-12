import { Suspense } from "react";
import { DsaEmailActionScreen } from "@/components/screens/dsa-email-action-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function DsaEmailActionPage({ params }: PageProps) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">Loading action portal...</div>}>
      <DsaEmailActionScreen token={resolvedParams.token} />
    </Suspense>
  );
}
