import { redirect } from "next/navigation";

export default async function LegacyReview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id } = await params;
  const { doc } = await searchParams;
  redirect(`/deals/${id}/approvals${doc ? `?doc=${doc}` : ""}`);
}
