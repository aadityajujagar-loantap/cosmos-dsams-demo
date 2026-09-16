import { Suspense } from "react";
import { DsaUploadSignedAgreementScreen } from "@/components/screens/dsa-upload-signed-agreement-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function DsaUploadSignedAgreementPage({ params }: PageProps) {
  const resolvedParams = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-xs">
          Loading agreement upload portal...
        </div>
      }
    >
      <DsaUploadSignedAgreementScreen token={resolvedParams.token} />
    </Suspense>
  );
}
