import { redirect } from "next/navigation";

export default async function LegacySme({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string; q?: string }>;
}) {
  const { id } = await params;
  const { doc, q } = await searchParams;
  if (q) redirect(`/deals/${id}/questions/${q}`);
  redirect(`/deals/${id}/questions${doc ? `?doc=${doc}` : ""}`);
}
