import { randomUUID } from "crypto";
import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_TOTAL_BYTES = 1 * 1024 * 1024 * 1024; // 1GB

const createVideoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  duration: z
    .preprocess((v) => {
      if (typeof v === "string" && v.trim().length > 0) return Number(v);
      return undefined;
    }, z.number().int().min(0).max(60 * 60 * 24).optional())
    .optional(),
});

const allowedImageTypes: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const allowedVideoTypes: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

async function getDirectorySizeBytes(dirPath: string): Promise<number> {
  let total = 0;
  let entries: string[] = [];

  try {
    entries = await readdir(dirPath);
  } catch {
    return 0;
  }

  for (const entry of entries) {
    const full = path.join(dirPath, entry);
    const s = await stat(full);
    if (s.isDirectory()) {
      total += await getDirectorySizeBytes(full);
    } else {
      total += s.size;
    }
  }

  return total;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const title = form.get("title");
  const description = form.get("description");
  const duration = form.get("duration");
  const file = form.get("file");
  const thumbnail = form.get("thumbnail");

  const parsed = createVideoSchema.safeParse({
    title,
    description: typeof description === "string" && description.trim() ? description : undefined,
    duration,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const ext = allowedVideoTypes[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported video type" }, { status: 415 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "videos");
  await mkdir(uploadDir, { recursive: true });

  let usedBytes = 0;
  try {
    usedBytes = await getDirectorySizeBytes(uploadDir);
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: string };
    console.error("watchtube: failed to compute uploads dir size", {
      name: e?.name,
      code: e?.code,
      message: e?.message,
    });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  if (usedBytes + file.size > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: "Storage limit reached",
        limitBytes: MAX_TOTAL_BYTES,
        usedBytes,
        remainingBytes: Math.max(0, MAX_TOTAL_BYTES - usedBytes),
      },
      { status: 413 },
    );
  }

  const filename = `${randomUUID()}${ext}`;
  const absoluteVideoPath = path.join(uploadDir, filename);
  const publicVideoUrl = `/uploads/videos/${filename}`;

  const thumbsDir = path.join(process.cwd(), "public", "uploads", "thumbs");
  let absoluteThumbPath: string | null = null;
  let publicThumbUrl: string | null = null;

  if (thumbnail instanceof File && thumbnail.size > 0) {
    const thumbExt = allowedImageTypes[thumbnail.type];
    if (!thumbExt) {
      return NextResponse.json({ error: "Unsupported thumbnail type" }, { status: 415 });
    }

    await mkdir(thumbsDir, { recursive: true });
    const thumbFilename = `${randomUUID()}${thumbExt}`;
    absoluteThumbPath = path.join(thumbsDir, thumbFilename);
    publicThumbUrl = `/uploads/thumbs/${thumbFilename}`;
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(absoluteVideoPath, buf, { flag: "wx" });

    if (thumbnail instanceof File && thumbnail.size > 0 && absoluteThumbPath && publicThumbUrl) {
      const thumbBuf = Buffer.from(await thumbnail.arrayBuffer());
      await writeFile(absoluteThumbPath, thumbBuf, { flag: "wx" });
    }

    const video = await prisma.video.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        thumbnail: publicThumbUrl,
        url: publicVideoUrl,
        duration: parsed.data.duration ?? 0,
        authorId: session.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        url: true,
        duration: true,
        views: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.log.create({
      data: {
        action: "video.create",
        details: JSON.stringify({
          videoId: video.id,
          authorId: session.id,
          bytes: file.size,
          url: publicVideoUrl,
          thumbnail: publicThumbUrl,
          duration: parsed.data.duration ?? 0,
        }),
        userId: session.id,
      },
    });

    const subscriptions = await prisma.subscription.findMany({
      where: { channelId: session.id },
      select: { subscriberId: true },
    });

    if (subscriptions.length > 0) {
      await prisma.notification.createMany({
        data: subscriptions.map((s) => ({
          type: "VIDEO",
          message: `${session.username} a publié une nouvelle vidéo : «${video.title}».`,
          userId: s.subscriberId,
          actorId: session.id,
          videoId: video.id,
        })),
      });
    }

    return NextResponse.json({ video }, { status: 201 });
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: string };
    console.error("watchtube: /api/videos upload failed", {
      name: e?.name,
      code: e?.code,
      message: e?.message,
    });

    try {
      await unlink(absoluteVideoPath);
    } catch {
      // ignore cleanup failures
    }

    if (absoluteThumbPath) {
      try {
        await unlink(absoluteThumbPath);
      } catch {
        // ignore cleanup failures
      }
    }

    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
