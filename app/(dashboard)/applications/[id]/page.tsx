import { ApplicationDetailPage } from "@/components/screens/lead-application-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApplicationDetailPage id={id} />;
}
