import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: channelId } = await params;

  if (channelId === session.id) {
    return NextResponse.json({ error: "Cannot subscribe to yourself" }, { status: 400 });
  }

  const existing = await prisma.subscription.findFirst({
    where: { subscriberId: session.id, channelId },
    select: { id: true },
  });

  if (existing) {
    await prisma.subscription.deleteMany({ where: { subscriberId: session.id, channelId } });
  } else {
    try {
      await prisma.subscription.create({
        data: { subscriberId: session.id, channelId },
        select: { id: true },
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const subscribed = !existing;
  const subscriberCount = await prisma.subscription.count({ where: { channelId } });

  await prisma.log.create({
    data: {
      action: subscribed ? "subscription.create" : "subscription.delete",
      details: JSON.stringify({ subscriberId: session.id, channelId }),
      userId: session.id,
    },
  });

  if (subscribed) {
    const message = `${session.username} s’est abonné à ta chaîne.`;

    const existingNotification = await prisma.notification.findFirst({
      where: {
        type: "SUBSCRIPTION",
        userId: channelId,
        actorId: session.id,
        videoId: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingNotification) {
      await prisma.notification.update({
        where: { id: existingNotification.id },
        data: {
          message,
          isRead: false,
          createdAt: new Date(),
        },
        select: { id: true },
      });
    } else {
      await prisma.notification.create({
        data: {
          type: "SUBSCRIPTION",
          message,
          userId: channelId,
          actorId: session.id,
        },
        select: { id: true },
      });
    }
  }

  return NextResponse.json({ subscribed, subscriberCount }, { status: 200 });
}
