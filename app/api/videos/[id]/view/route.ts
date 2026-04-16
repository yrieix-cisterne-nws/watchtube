import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const video = await prisma.video.update({
      where: { id },
      data: { views: { increment: 1 } },
      select: { views: true },
    });

    return NextResponse.json({ views: video.views }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
