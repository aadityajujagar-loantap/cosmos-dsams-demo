import { DsaProfilePage } from "@/components/screens/dsa-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DsaProfilePage id={id} />;
}
