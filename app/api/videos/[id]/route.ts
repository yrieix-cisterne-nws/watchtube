import { unlink } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const updateVideoSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
  })
  .refine((v) => typeof v.title === "string" || typeof v.description === "string", {
    message: "No fields to update",
  });

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.video.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.authorId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextTitle =
    typeof parsed.data.title === "string" ? parsed.data.title.trim() : undefined;
  const nextDescription =
    typeof parsed.data.description === "string"
      ? parsed.data.description.trim()
      : undefined;

  if (typeof nextTitle === "string" && nextTitle.length === 0) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  try {
    const updated = await prisma.video.update({
      where: { id },
      data: {
        ...(typeof nextTitle === "string" ? { title: nextTitle } : null),
        ...(typeof nextDescription === "string"
          ? { description: nextDescription.length > 0 ? nextDescription : null }
          : null),
      },
      select: { id: true, title: true, description: true },
    });

    await prisma.log.create({
      data: {
        action: "video.update",
        details: JSON.stringify({
          videoId: updated.id,
          authorId: session.id,
          titleUpdated: typeof nextTitle === "string",
          descriptionUpdated: typeof nextDescription === "string",
        }),
        userId: session.id,
      },
    });

    return NextResponse.json({ video: updated });
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: string };
    console.error("watchtube: /api/videos/[id] patch failed", {
      name: e?.name,
      code: e?.code,
      message: e?.message,
    });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
