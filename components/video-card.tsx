import Link from "next/link";

export type VideoCardData = {
  id: string;
  title: string;
  channelName: string;
  channelInitials: string;
  viewsLabel: string;
  dateLabel: string;
  durationLabel: string;
  thumbnailUrl?: string | null;
};

export function VideoCard({ video }: { video: VideoCardData }) {
  return (
    <Link
      href={`/watch/${video.id}`}
      className="group block rounded-2xl focus:outline-none focus:ring-2 focus:ring-border/60"
    >
      <div className="relative overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
        <div className="aspect-video w-full">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-linear-to-br from-border/40 to-surface" />
          )}
        </div>
        <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
          {video.durationLabel}
        </div>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border/25 text-sm font-semibold text-foreground ring-1 ring-border">
          {video.channelInitials}
        </div>

        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-foreground">
            {video.title}
          </div>
          <div className="mt-1 text-xs text-muted">
            {video.channelName} • {video.viewsLabel} • {video.dateLabel}
          </div>
        </div>
      </div>
    </Link>
  );
}
