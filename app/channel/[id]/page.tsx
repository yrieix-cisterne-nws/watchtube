import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

type SortKey = "date" | "views";

function normalizeSort(input: string | string[] | undefined): SortKey {
  const v = Array.isArray(input) ? input[0] : input;
  if (v === "views") return "views";
  return "date";
}

export default async function ChannelByIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { sort } = await searchParams;
  const sortKey = normalizeSort(sort);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { username: true },
  });

  if (!user) {
    notFound();
  }

  const href =
    sortKey === "views"
      ? `/c/${encodeURIComponent(user.username)}?sort=views`
      : `/c/${encodeURIComponent(user.username)}?sort=date`;

  redirect(href);
}
