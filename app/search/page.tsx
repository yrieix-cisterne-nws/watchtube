import { VideoCard, type VideoCardData } from "@/components/video-card";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";

const getSearchVideos = unstable_cache(
  async (query: string) => {
    return prisma.video.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { author: { username: { contains: query } } },
        ],
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
  },
  ["search"],
  { revalidate: 30 },
);

type SearchParams = { [key: string]: string | string[] | undefined };

function normalizeQ(input: string | string[] | undefined): string {
  const q = Array.isArray(input) ? input[0] : input;
  return typeof q === "string" ? q.trim() : "";
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

function formatDateLabel(input: unknown) {
  const date = input instanceof Date ? input : new Date(input as never);
  if (!Number.isFinite(date.getTime())) return "";

  const d = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `le ${d}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();

  const { q } = await searchParams;
  const query = normalizeQ(q);

  const videos = query
    ? await getSearchVideos(query)
    : [];

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
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Recherche</h1>
        <p className="mt-2 text-muted">
          {query ? (
            <>
              Résultats pour <span className="font-semibold text-foreground">{query}</span>
            </>
          ) : (
            "Tape une recherche dans la barre en haut."
          )}
        </p>
      </div>

      {query && items.length === 0 ? (
        <div className="rounded-2xl bg-surface p-6 text-sm text-foreground ring-1 ring-border">
          Aucun résultat.
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
