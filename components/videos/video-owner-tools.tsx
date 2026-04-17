"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type Props = {
  videoId: string;
  authorUsername: string;
  initialTitle: string;
  initialDescription: string | null;
  isOwner: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getErrorMessage(v: unknown): string | null {
  if (!isRecord(v)) return null;
  return typeof v.error === "string" ? v.error : null;
}

export function VideoOwnerTools({
  videoId,
  authorUsername,
  initialTitle,
  initialDescription,
  isOwner,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    return (
      title.trim() !== initialTitle.trim() ||
      description.trim() !== (initialDescription ?? "").trim()
    );
  }, [description, initialDescription, initialTitle, title]);

  if (!isOwner) return null;

  async function onSave(e: FormEvent) {
    e.preventDefault();

    const t = title.trim();
    if (!t) {
      setError("Le titre est obligatoire.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, description }),
      });

      const json: unknown = await res.json().catch(() => null);

      if (res.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(`/watch/${videoId}`)}`);
        return;
      }

      if (!res.ok) {
        setError(getErrorMessage(json) ?? "Modification impossible.");
        return;
      }

      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Supprimer cette vidéo ?")) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json: unknown = await res.json().catch(() => null);

      if (res.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(`/watch/${videoId}`)}`);
        return;
      }

      if (!res.ok) {
        setError(getErrorMessage(json) ?? "Suppression impossible.");
        return;
      }

      router.push(`/c/${encodeURIComponent(authorUsername)}`);
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl bg-surface p-4 ring-1 ring-border">
      <div className="text-sm font-semibold text-foreground">
        Gérer ta vidéo
      </div>

      {error ? (
        <div className="mt-3 rounded-xl bg-background p-3 text-sm text-foreground ring-1 ring-border">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSave} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted">Titre</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="h-10 rounded-xl bg-background px-3 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={4}
            className="w-full resize-y rounded-xl bg-background px-3 py-2 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background ring-1 ring-border hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Sauvegarde..." : "Enregistrer"}
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-background px-4 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-background/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </form>
    </div>
  );
}
