import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const views = await prisma.$transaction(async (tx) => {
      let inserted = false;

      try {
        await tx.videoView.create({
          data: {
            userId: session.id,
            videoId: id,
          },
          select: { id: true },
        });
        inserted = true;
      } catch (err) {
        const e = err as { code?: string };
        // Unique constraint: the user already viewed this video.
        if (e?.code === "P2002") {
          inserted = false;
        } else {
          // Likely FK (video not found) or other DB error.
          throw err;
        }
      }

      if (inserted) {
        const updated = await tx.video.update({
          where: { id },
          data: { views: { increment: 1 } },
          select: { views: true },
        });
        return updated.views;
      }

      const video = await tx.video.findUnique({
        where: { id },
        select: { views: true },
      });

      if (!video) {
        throw new Error("NOT_FOUND");
      }

      return video.views;
    });

    return NextResponse.json({ views }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
