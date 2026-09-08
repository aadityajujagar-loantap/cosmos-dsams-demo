import { DsaVerifyEmailScreen } from "@/components/screens/dsa-verify-email-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function DsaVerifyEmailTokenPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <DsaVerifyEmailScreen token={resolvedParams.token} />;
}
