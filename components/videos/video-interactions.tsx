"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
  };
  replies?: CommentItem[];
};

type LikeState = {
  liked: boolean;
  likeCount: number;
};

type SubscribeState = {
  subscribed: boolean;
  subscriberCount: number;
};

type Props = {
  videoId: string;
  authorId: string;
  authorUsername: string;
  initialLikeCount: number;
  initialCommentCount: number;
  initialLiked: boolean;
  initialComments: CommentItem[];
  initialSubscribed: boolean;
  initialSubscriberCount: number;
  canInteract: boolean;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        d="M12 21s-7-4.35-9.33-8.66C.9 9.07 2.96 5.5 6.83 5.5c1.98 0 3.38 1.04 4.17 2.08.79-1.04 2.19-2.08 4.17-2.08 3.87 0 5.93 3.57 4.16 6.84C19 16.65 12 21 12 21Z"
      />
    </svg>
  );
}

function formatDate(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getErrorMessage(v: unknown): string | null {
  if (!isRecord(v)) return null;
  return typeof v.error === "string" ? v.error : null;
}

function parseLikePayload(v: unknown): LikeState | null {
  if (!isRecord(v)) return null;
  if (typeof v.liked !== "boolean") return null;
  if (typeof v.likeCount !== "number") return null;
  return { liked: v.liked, likeCount: v.likeCount };
}

function parseSubscribePayload(v: unknown): SubscribeState | null {
  if (!isRecord(v)) return null;
  if (typeof v.subscribed !== "boolean") return null;
  if (typeof v.subscriberCount !== "number") return null;
  return { subscribed: v.subscribed, subscriberCount: v.subscriberCount };
}

function parseCommentItem(v: unknown): CommentItem | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== "string") return null;
  if (typeof v.content !== "string") return null;
  if (typeof v.createdAt !== "string") return null;

  const user = v.user;
  if (!isRecord(user)) return null;
  if (typeof user.username !== "string") return null;

  let replies: CommentItem[] | undefined;
  if (Array.isArray(v.replies)) {
    const parsedReplies: CommentItem[] = [];
    for (const r of v.replies) {
      const parsed = parseCommentItem(r);
      if (parsed) parsedReplies.push(parsed);
    }
    replies = parsedReplies;
  }

  return { id: v.id, content: v.content, createdAt: v.createdAt, user: { username: user.username }, replies };
}

function parseCommentPayload(v: unknown): CommentItem | null {
  if (!isRecord(v)) return null;
  return parseCommentItem(v.comment);
}

export function VideoInteractions({
  videoId,
  authorId,
  authorUsername,
  initialLikeCount,
  initialCommentCount,
  initialLiked,
  initialComments,
  initialSubscribed,
  initialSubscriberCount,
  canInteract,
}: Props) {
  const router = useRouter();
  const [like, setLike] = useState<LikeState>({
    liked: initialLiked,
    likeCount: initialLikeCount,
  });
  const [subscribe, setSubscribe] = useState<SubscribeState>({
    subscribed: initialSubscribed,
    subscriberCount: initialSubscriberCount,
  });
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [liking, setLiking] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const likeLabel = useMemo(() => {
    return like.likeCount === 1 ? "1 like" : `${like.likeCount} likes`;
  }, [like.likeCount]);

  // Count a view once per page mount.
  useEffect(() => {
    const ac = new AbortController();
    void fetch(`/api/videos/${videoId}/view`, {
      method: "POST",
      credentials: "include",
      signal: ac.signal,
    }).catch(() => {
      // ignore
    });

    return () => ac.abort();
  }, [videoId]);

  async function toggleLike() {
    if (!canInteract) {
      router.push("/auth");
      return;
    }

    setError(null);
    setLiking(true);

    try {
      const res = await fetch(`/api/videos/${videoId}/like`, {
        method: "POST",
        credentials: "include",
      });

      if (res.status === 401) {
        router.push("/auth");
        return;
      }

      const json: unknown = await res.json().catch(() => null);
      const payload = parseLikePayload(json);

      if (!res.ok || !payload) {
        setError("Impossible de liker.");
        return;
      }

      setLike(payload);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLiking(false);
    }
  }

  async function toggleSubscribe() {
    if (!canInteract) {
      router.push("/auth");
      return;
    }

    setError(null);
    setSubscribing(true);

    try {
      const res = await fetch(`/api/users/${authorId}/subscribe`, {
        method: "POST",
        credentials: "include",
      });

      if (res.status === 401) {
        router.push("/auth");
        return;
      }

      const json: unknown = await res.json().catch(() => null);
      const payload = parseSubscribePayload(json);

      if (!res.ok || !payload) {
        setError("Impossible de s’abonner.");
        return;
      }

      setSubscribe(payload);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSubscribing(false);
    }
  }

  async function postComment(e: FormEvent) {
    e.preventDefault();

    if (!canInteract) {
      router.push("/auth");
      return;
    }

    const content = commentText.trim();
    if (!content) return;

    setPosting(true);
    setError(null);

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.status === 401) {
        router.push("/auth");
        return;
      }

      const json: unknown = await res.json().catch(() => null);
      const comment = parseCommentPayload(json);

      if (!res.ok || !comment) {
        setError(getErrorMessage(json) ?? "Commentaire impossible.");
        return;
      }

      setComments((prev) => [...prev, { ...comment, replies: [] }]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    } catch {
      setError("Erreur réseau.");
    } finally {
      setPosting(false);
    }
  }

  async function postReply(e: FormEvent) {
    e.preventDefault();

    if (!canInteract) {
      router.push("/auth");
      return;
    }

    if (!replyTo) return;

    const content = replyText.trim();
    if (!content) return;

    setPosting(true);
    setError(null);

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId: replyTo.id }),
      });

      if (res.status === 401) {
        router.push("/auth");
        return;
      }

      const json: unknown = await res.json().catch(() => null);
      const reply = parseCommentPayload(json);

      if (!res.ok || !reply) {
        setError(getErrorMessage(json) ?? "Réponse impossible.");
        return;
      }

      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== replyTo.id) return c;
          const replies = Array.isArray(c.replies) ? c.replies : [];
          return { ...c, replies: [...replies, reply] };
        }),
      );
      setCommentCount((c) => c + 1);
      setReplyText("");
      setReplyTo(null);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex flex-wrap items-center gap-3">
          <div className="text-sm text-foreground">
            <span className="text-muted">Chaîne :</span>{" "}
            <Link
              href={`/c/${encodeURIComponent(authorUsername)}`}
              className="font-semibold hover:underline"
            >
              {authorUsername}
            </Link>
            <span className="ml-2 text-xs text-muted">
              {subscribe.subscriberCount === 1
                ? "1 abonné"
                : `${subscribe.subscriberCount} abonnés`}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleSubscribe}
            disabled={subscribing}
            className={
              subscribe.subscribed
                ? "inline-flex h-9 items-center justify-center rounded-xl bg-surface px-4 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-surface/80 disabled:opacity-60"
                : "inline-flex h-9 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background ring-1 ring-border hover:bg-foreground/90 disabled:opacity-60"
            }
            aria-label={subscribe.subscribed ? "Se désabonner" : "S’abonner"}
          >
            {subscribing
              ? "..."
              : subscribe.subscribed
                ? "Abonné"
                : "S’abonner"}
          </button>
        </div>

        <button
          type="button"
          onClick={toggleLike}
          disabled={liking}
          className={
            like.liked
              ? "inline-flex h-10 items-center gap-2 rounded-2xl bg-surface px-4 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-surface/80 disabled:opacity-60"
              : "inline-flex h-10 items-center gap-2 rounded-2xl bg-surface px-4 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-surface/80 disabled:opacity-60"
          }
          aria-label={like.liked ? "Retirer le like" : "Liker"}
        >
          <HeartIcon filled={like.liked} />
          <span>{likeLabel}</span>
        </button>

        <div className="text-sm text-muted">
          {commentCount === 1 ? "1 commentaire" : `${commentCount} commentaires`}
        </div>

        {error ? <div className="text-sm text-red-200">{error}</div> : null}
      </div>

      <div className="mt-5 rounded-2xl bg-surface p-4 ring-1 ring-border">
        <form onSubmit={postComment} className="flex flex-col gap-3">
          <label className="text-sm font-semibold text-foreground">Commenter</label>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full resize-y rounded-xl bg-background px-3 py-2 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
            placeholder={canInteract ? "Écris un commentaire..." : "Connecte-toi pour commenter"}
            disabled={!canInteract || posting}
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={!canInteract || posting || commentText.trim().length === 0}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background ring-1 ring-border hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {posting ? "Envoi..." : "Publier"}
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-col gap-4">
          {comments.length === 0 ? (
            <div className="text-sm text-muted">Aucun commentaire.</div>
          ) : (
            comments.map((c) => {
              const replies = Array.isArray(c.replies) ? c.replies : [];
              const isReplying = replyTo?.id === c.id;

              return (
                <div key={c.id} className="rounded-xl bg-background p-3 ring-1 ring-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">{c.user.username}</div>
                    <div className="text-xs text-muted">{formatDate(c.createdAt)}</div>
                  </div>

                  <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">{c.content}</div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo({ id: c.id, username: c.user.username });
                        setReplyText("");
                      }}
                      className="text-xs font-semibold text-muted hover:text-foreground"
                      disabled={!canInteract || posting}
                    >
                      Répondre
                    </button>

                    {isReplying ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(null);
                          setReplyText("");
                        }}
                        className="text-xs font-semibold text-muted hover:text-foreground"
                        disabled={posting}
                      >
                        Annuler
                      </button>
                    ) : null}
                  </div>

                  {isReplying ? (
                    <form onSubmit={postReply} className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        className="w-full resize-y rounded-xl bg-background px-3 py-2 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
                        placeholder={
                          canInteract
                            ? `Répondre à ${replyTo?.username}...`
                            : "Connecte-toi pour répondre"
                        }
                        disabled={!canInteract || posting}
                      />

                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={!canInteract || posting || replyText.trim().length === 0}
                          className="inline-flex h-8 items-center justify-center rounded-xl bg-foreground px-3 text-xs font-semibold text-background ring-1 ring-border hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {posting ? "Envoi..." : "Répondre"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {replies.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-3 border-l border-border pl-3">
                      {replies.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl bg-background p-3 ring-1 ring-border"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-foreground">
                              {r.user.username}
                            </div>
                            <div className="text-xs text-muted">{formatDate(r.createdAt)}</div>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                            {r.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
