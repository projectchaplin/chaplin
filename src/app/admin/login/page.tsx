import { redirect } from "next/navigation";

export default async function LegacyAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const requestedNext = (await searchParams).next;
  const next = typeof requestedNext === "string" && requestedNext.startsWith("/admin")
    ? `?next=${encodeURIComponent(requestedNext)}`
    : "";
  redirect(`/super-admin${next}`);
}
