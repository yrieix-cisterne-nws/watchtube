import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().min(1).max(64).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: videoId } = await params;

  // Return oldest -> newest, with replies nested.
  const all = await prisma.comment.findMany({
    where: { videoId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      content: true,
      createdAt: true,
      parentId: true,
      user: {
        select: {
          username: true,
        },
      },
    },
  });

  type Node = {
    id: string;
    content: string;
    createdAt: string;
    user: { username: string };
    replies: Node[];
    parentId: string | null;
  };

  const map = new Map<string, Node>();
  for (const c of all) {
    map.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      replies: [],
      parentId: c.parentId,
    });
  }

  const roots: Node[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json({ comments: roots }, { status: 200 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: videoId } = await params;
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let parentId: string | null = null;
  if (typeof parsed.data.parentId === "string") {
    const parent = await prisma.comment.findFirst({
      where: { id: parsed.data.parentId, videoId },
      select: { id: true },
    });

    if (!parent) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }

    parentId = parent.id;
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        content: parsed.data.content,
        userId: session.id,
        videoId,
        parentId,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    await prisma.log.create({
      data: {
        action: parentId ? "comment.reply" : "comment.create",
        details: JSON.stringify({
          videoId,
          commentId: comment.id,
          parentId,
          userId: session.id,
        }),
        userId: session.id,
      },
    });

    return NextResponse.json(
      {
        comment: {
          ...comment,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
