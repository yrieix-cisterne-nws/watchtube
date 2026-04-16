import Link from "next/link";
import { notFound } from "next/navigation";

import { VideoCard, type VideoCardData } from "@/components/video-card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

type SortKey = "date" | "views";

function normalizeSort(input: string | string[] | undefined): SortKey {
  const v = Array.isArray(input) ? input[0] : input;
  if (v === "views") return "views";
  return "date";
}

function getUserInitials(username: string) {
  const cleaned = username.trim();
  if (!cleaned) return "??";

  const parts = cleaned
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? "?"}${parts[1][0] ?? "?"}`.toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatViews(views: number) {
  if (!Number.isFinite(views) || views < 0) return "0 vues";
  return `${views} vues`;
}

function formatDateLabel(date: Date) {
  const d = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `le ${d}`;
}

export default async function ChannelByUsernamePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { username } = await params;
  const { sort } = await searchParams;
  const sortKey = normalizeSort(sort);

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
    },
  });

  if (!user) {
    notFound();
  }

  const [subscriberCount, videos] = await Promise.all([
    prisma.subscription.count({ where: { channelId: user.id } }),
    prisma.video.findMany({
      where: { authorId: user.id },
      orderBy:
        sortKey === "views"
          ? [{ views: "desc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }],
      take: 48,
      select: {
        id: true,
        title: true,
        views: true,
        duration: true,
        thumbnail: true,
        createdAt: true,
        author: {
          select: {
            username: true,
          },
        },
      },
    }),
  ]);

  const items: VideoCardData[] = videos.map((v) => ({
    id: v.id,
    title: v.title,
    channelName: v.author.username,
    channelInitials: getUserInitials(v.author.username),
    viewsLabel: formatViews(v.views),
    dateLabel: formatDateLabel(v.createdAt),
    durationLabel: formatDuration(v.duration),
    thumbnailUrl: v.thumbnail,
  }));

  const sortDateHref = `/c/${encodeURIComponent(username)}?sort=date`;
  const sortViewsHref = `/c/${encodeURIComponent(username)}?sort=views`;

  return (
    <div className="pb-10">
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-border/25 text-lg font-extrabold text-foreground ring-1 ring-border">
            {getUserInitials(user.username)}
          </div>

          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {user.username}
            </h1>
            <div className="mt-1 text-sm text-muted">
              {subscriberCount === 1 ? "1 abonné" : `${subscriberCount} abonnés`}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={sortDateHref}
              className={
                sortKey === "date"
                  ? "inline-flex h-9 items-center justify-center rounded-xl bg-background px-3 text-sm font-semibold text-foreground ring-1 ring-border"
                  : "inline-flex h-9 items-center justify-center rounded-xl bg-surface px-3 text-sm font-semibold text-muted ring-1 ring-border hover:bg-surface/80"
              }
            >
              Date
            </Link>
            <Link
              href={sortViewsHref}
              className={
                sortKey === "views"
                  ? "inline-flex h-9 items-center justify-center rounded-xl bg-background px-3 text-sm font-semibold text-foreground ring-1 ring-border"
                  : "inline-flex h-9 items-center justify-center rounded-xl bg-surface px-3 text-sm font-semibold text-muted ring-1 ring-border hover:bg-surface/80"
              }
            >
              Vues
            </Link>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface p-6 text-sm text-foreground ring-1 ring-border">
          Aucune vidéo publiée.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
