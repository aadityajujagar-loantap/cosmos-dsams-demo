import { BorrowerJourneyPage } from "@/components/screens/sell-now-page";

export default async function Page({
  params,
}: {
  params: Promise<{ configId: string }>;
}) {
  const { configId } = await params;
  return <BorrowerJourneyPage configId={configId} />;
}
