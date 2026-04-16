import { redirect } from "next/navigation";

import { VideoCard, type VideoCardData } from "@/components/video-card";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export default async function LikedPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect(`/auth?next=${encodeURIComponent("/liked")}`);
  }

  const videos = await prisma.video.findMany({
    where: {
      likes: {
        some: {
          userId: session.id,
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
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Favoris</h1>
        <p className="mt-2 text-muted">Les vidéos que tu as likées.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-surface p-6 text-sm text-foreground ring-1 ring-border">
          Aucune vidéo likée pour l’instant.
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
