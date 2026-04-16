import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getLikeCount(videoId: string) {
  return prisma.like.count({ where: { videoId } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: videoId } = await params;
  const session = await getSessionUser();

  const likeCount = await getLikeCount(videoId);

  if (!session) {
    return NextResponse.json({ liked: false, likeCount }, { status: 200 });
  }

  const existing = await prisma.like.findFirst({
    where: { videoId, userId: session.id },
    select: { id: true },
  });

  return NextResponse.json({ liked: Boolean(existing), likeCount }, { status: 200 });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: videoId } = await params;
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.like.findFirst({
    where: { videoId, userId: session.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.like.deleteMany({ where: { videoId, userId: session.id } });
  } else {
    // If the video doesn't exist, this will fail with a FK constraint (db-level), so handle as 404-ish.
    try {
      await prisma.like.create({
        data: { videoId, userId: session.id },
        select: { id: true },
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const likeCount = await getLikeCount(videoId);
  const liked = !existing;

  if (liked) {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        title: true,
        authorId: true,
      },
    });

    if (video && video.authorId !== session.id) {
      await prisma.notification.create({
        data: {
          type: "LIKE",
          message: `${session.username} a liké ta vidéo «${video.title}».`,
          userId: video.authorId,
          actorId: session.id,
          videoId,
        },
        select: { id: true },
      });
    }
  }

  return NextResponse.json({ liked, likeCount }, { status: 200 });
}
