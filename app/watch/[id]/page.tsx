import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { VideoInteractions } from "@/components/videos/video-interactions";
import { VideoOwnerTools } from "@/components/videos/video-owner-tools";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();

  if (!session) {
    redirect(`/auth?next=${encodeURIComponent(`/watch/${id}`)}`);
  }

  const video = await prisma.video.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      url: true,
      views: true,
      author: {
        select: {
          id: true,
          username: true,
        },
      },
      createdAt: true,
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  });

  if (!video) {
    notFound();
  }

  const liked = session
    ? Boolean(
        await prisma.like.findFirst({
          where: { videoId: id, userId: session.id },
          select: { id: true },
        }),
      )
    : false;

  const [subscriberCount, subscribed] = await Promise.all([
    prisma.subscription.count({ where: { channelId: video.author.id } }),
    session
      ? prisma.subscription
          .findFirst({
            where: { channelId: video.author.id, subscriberId: session.id },
            select: { id: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ]);

  const allComments = await prisma.comment.findMany({
    where: { videoId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      content: true,
      createdAt: true,
      parentId: true,
      user: {
        select: { username: true },
      },
    },
  });

  type CommentNode = {
    id: string;
    content: string;
    createdAt: string;
    user: { username: string };
    replies: CommentNode[];
    parentId: string | null;
  };

  const commentMap = new Map<string, CommentNode>();
  for (const c of allComments) {
    commentMap.set(c.id, {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      parentId: c.parentId,
      replies: [],
    });
  }

  const commentRoots: CommentNode[] = [];
  for (const node of commentMap.values()) {
    if (node.parentId && commentMap.has(node.parentId)) {
      commentMap.get(node.parentId)!.replies.push(node);
    } else {
      commentRoots.push(node);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-border">
        <video src={video.url} controls className="aspect-video h-auto w-full" />
      </div>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
        {video.title}
      </h1>

      <div className="mt-2 text-sm text-muted">
        <Link
          href={`/c/${encodeURIComponent(video.author.username)}`}
          className="font-semibold text-foreground hover:underline"
        >
          {video.author.username}
        </Link>
        <span className="mx-2">•</span>
        <span>{video.views} vues</span>
        <span className="mx-2">•</span>
        <span>
          {new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(video.createdAt)}
        </span>
      </div>

      {video.description ? (
        <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-surface p-4 text-sm text-foreground ring-1 ring-border">
          {video.description}
        </div>
      ) : null}

      <VideoOwnerTools
        videoId={video.id}
        authorUsername={video.author.username}
        initialTitle={video.title}
        initialDescription={video.description}
        isOwner={session.id === video.author.id}
      />

      <VideoInteractions
        videoId={id}
        authorId={video.author.id}
        authorUsername={video.author.username}
        initialLikeCount={video._count.likes}
        initialCommentCount={video._count.comments}
        initialLiked={liked}
        initialComments={commentRoots}
        initialSubscribed={subscribed}
        initialSubscriberCount={subscriberCount}
        canInteract={Boolean(session)}
      />
    </div>
  );
}
