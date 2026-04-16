import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function isSafeSegment(seg: string): boolean {
  if (!seg) return false;
  if (seg === "." || seg === "..") return false;
  if (seg.includes("..")) return false;
  if (seg.includes("\\")) return false;
  return true;
}

function parseRangeHeader(range: string, size: number): { start: number; end: number } | null {
  // Only support a single range: bytes=start-end
  const m = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if (!m) return null;

  const startStr = m[1];
  const endStr = m[2];

  let start: number;
  let end: number;

  if (startStr === "" && endStr === "") return null;

  if (startStr === "") {
    // suffix range: bytes=-N
    const suffixLen = Number(endStr);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return null;
    start = Math.max(0, size - suffixLen);
    end = size - 1;
    return { start, end };
  }

  start = Number(startStr);
  if (!Number.isFinite(start) || start < 0) return null;

  if (endStr === "") {
    end = size - 1;
  } else {
    end = Number(endStr);
    if (!Number.isFinite(end) || end < start) return null;
    end = Math.min(end, size - 1);
  }

  if (start >= size) return null;
  return { start, end };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  if (!Array.isArray(segments) || segments.length === 0 || !segments.every(isSafeSegment)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const absPath = path.join(uploadsRoot, ...segments);

  // Prevent path traversal
  const rel = path.relative(uploadsRoot, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(absPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let st;
  try {
    st = await stat(absPath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!st.isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const size = st.size;
  const range = req.headers.get("range");

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  if (!range) {
    headers.set("Content-Length", String(size));
    const nodeStream = createReadStream(absPath);
    return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
      status: 200,
      headers,
    });
  }

  const parsed = parseRangeHeader(range, size);
  if (!parsed) {
    headers.set("Content-Range", `bytes */${size}`);
    return new NextResponse(null, { status: 416, headers });
  }

  const { start, end } = parsed;
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));

  const nodeStream = createReadStream(absPath, { start, end });
  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 206,
    headers,
  });
}
