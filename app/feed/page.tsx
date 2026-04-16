import { redirect } from "next/navigation";

import { VideoCard, type VideoCardData } from "../../components/video-card";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

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

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { scope } = await searchParams;
  const normalizedScope = Array.isArray(scope) ? scope[0] : scope;
  const isSubscriptions = normalizedScope === "subscriptions";

  const videos = isSubscriptions
    ? await (async () => {
        const session = await getSessionUser();
        if (!session) {
          redirect(`/auth?next=${encodeURIComponent("/feed?scope=subscriptions")}`);
        }

        return prisma.video.findMany({
          where: {
            author: {
              subscribers: {
                some: { subscriberId: session.id },
              },
            },
          },
          orderBy: { createdAt: "desc" },
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
        });
      })()
    : await prisma.video.findMany({
        orderBy: { createdAt: "desc" },
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
      });

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

  return (
    <div className="pb-10">
      <div className="mb-8">
        {isSubscriptions ? (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Abonnements
            </h1>
            <p className="mt-2 text-muted">Les dernières vidéos des chaînes que tu suis.</p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold tracking-tight">
              <span className="bg-linear-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">
                Sélectionné
              </span>{" "}
              <span className="text-foreground">pour vous</span>
            </h1>
            <p className="mt-2 text-muted">
              Découvrez de nouveaux univers selon vos préférences.
            </p>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-surface p-6 text-sm text-foreground ring-1 ring-border">
          {isSubscriptions
            ? "Aucune vidéo d’abonnements pour l’instant."
            : "Aucune vidéo pour l’instant."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
