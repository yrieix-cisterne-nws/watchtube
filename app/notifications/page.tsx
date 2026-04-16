import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function NotificationsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect(`/auth?next=${encodeURIComponent("/notifications")}`);
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      message: true,
      isRead: true,
      createdAt: true,
      video: { select: { id: true } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Notifications</h1>
      <p className="mt-2 text-muted">Likes, abonnements et nouvelles vidéos.</p>

      {notifications.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-surface p-6 text-sm text-foreground ring-1 ring-border">
          Rien pour l’instant.
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {notifications.map((n) => {
            const href = n.video?.id ? `/watch/${n.video.id}` : "/feed";

            return (
              <Link
                key={n.id}
                href={href}
                className={
                  n.isRead
                    ? "rounded-2xl bg-surface p-4 text-sm text-foreground ring-1 ring-border hover:bg-surface/80"
                    : "rounded-2xl bg-surface p-4 text-sm text-foreground ring-2 ring-border hover:bg-surface/80"
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">{n.message}</div>
                    <div className="mt-1 text-xs text-muted">{formatDateLabel(n.createdAt)}</div>
                  </div>
                  {!n.isRead ? (
                    <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-foreground" />
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
