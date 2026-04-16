import { unlink } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toAbsolutePublicPath(publicUrl: string): string | null {
  if (!publicUrl.startsWith("/uploads/")) return null;
  if (publicUrl.includes("..")) return null;
  if (publicUrl.includes("\\")) return null;

  const publicRoot = path.join(process.cwd(), "public");
  const relative = publicUrl.replace(/^\//, "");
  const abs = path.join(publicRoot, relative);

  // Ensure the resolved path stays within /public
  const relToPublic = path.relative(publicRoot, abs);
  if (relToPublic.startsWith("..") || path.isAbsolute(relToPublic)) return null;

  return abs;
}

async function unlinkIfExists(absPath: string) {
  try {
    await unlink(absPath);
  } catch (err) {
    const e = err as { code?: string };
    if (e?.code !== "ENOENT") throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const video = await prisma.video.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      url: true,
      thumbnail: true,
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (video.authorId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowedPrefixes = [
    `/uploads/users/${session.id}/`,
    // Legacy paths (older videos) — still safe because we verify authorId above.
    "/uploads/videos/",
    "/uploads/thumbs/",
  ];

  const isAllowed = (p: string | null) =>
    typeof p === "string" && allowedPrefixes.some((prefix) => p.startsWith(prefix));

  if (!isAllowed(video.url) || (video.thumbnail && !isAllowed(video.thumbnail))) {
    return NextResponse.json({ error: "Invalid stored path" }, { status: 500 });
  }

  const absVideoPath = toAbsolutePublicPath(video.url);
  const absThumbPath = video.thumbnail ? toAbsolutePublicPath(video.thumbnail) : null;

  if (!absVideoPath || (video.thumbnail && !absThumbPath)) {
    return NextResponse.json({ error: "Invalid stored path" }, { status: 500 });
  }

  try {
    await unlinkIfExists(absVideoPath);
    if (absThumbPath) {
      await unlinkIfExists(absThumbPath);
    }

    await prisma.video.delete({ where: { id: video.id } });

    await prisma.log.create({
      data: {
        action: "video.delete",
        details: JSON.stringify({ videoId: video.id, authorId: session.id }),
        userId: session.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: string };
    console.error("watchtube: /api/videos/[id] delete failed", {
      name: e?.name,
      code: e?.code,
      message: e?.message,
    });

    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
