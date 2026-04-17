import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const takeParam = url.searchParams.get("take");
  const take = clampInt(Number(takeParam ?? 15) || 15, 1, 50);

  const [unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId: session.id, isRead: false } }),
    prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        message: true,
        isRead: true,
        createdAt: true,
        actor: {
          select: {
            username: true,
          },
        },
        video: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json(
    {
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
        actorUsername: n.actor?.username ?? null,
        videoId: n.video?.id ?? null,
        videoTitle: n.video?.title ?? null,
      })),
    },
    { status: 200 },
  );
}

export async function DELETE(_req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await prisma.notification.deleteMany({
    where: { userId: session.id },
  });

  await prisma.log.create({
    data: {
      action: "notifications.clear_all",
      details: JSON.stringify({ userId: session.id, deletedCount: res.count }),
      userId: session.id,
    },
  });

  return NextResponse.json(
    { ok: true, deletedCount: res.count },
    { status: 200 },
  );
}
