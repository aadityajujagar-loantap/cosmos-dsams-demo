import { DsaVerifyEmailScreen } from "@/components/screens/dsa-verify-email-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    token?: string;
    type?: string;
    application_id?: string;
    applicationId?: string;
  }>;
}

export default async function GlobalVerifyEmailPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  return (
    <DsaVerifyEmailScreen
      token={resolvedSearchParams.token}
      type={resolvedSearchParams.type}
      applicationId={resolvedSearchParams.application_id || resolvedSearchParams.applicationId}
    />
  );
}
