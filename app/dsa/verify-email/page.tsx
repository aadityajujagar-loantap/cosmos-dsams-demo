import { DsaVerifyEmailScreen } from "@/components/screens/dsa-verify-email-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function DsaVerifyEmailQueryPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  return <DsaVerifyEmailScreen token={resolvedSearchParams.token} />;
}
