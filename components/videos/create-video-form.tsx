"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type ApiOk = {
  video: {
    id: string;
  };
};

function asNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"] as const;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function CreateVideoForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoPreviewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const videoElRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [thumbnailPreviewUrl]);

  useEffect(() => {
    let cancelled = false;

    async function makeThumbnail() {
      setDurationSeconds(null);
      setThumbnailBlob(null);
      setThumbnailPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      const v = videoElRef.current;
      if (!v || !videoPreviewUrl) return;

      const wait = (event: string) =>
        new Promise<void>((resolve, reject) => {
          const onOk = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error("video error"));
          };
          const cleanup = () => {
            v.removeEventListener(event, onOk);
            v.removeEventListener("error", onErr);
          };
          v.addEventListener(event, onOk, { once: true });
          v.addEventListener("error", onErr, { once: true });
        });

      try {
        v.src = videoPreviewUrl;
        v.muted = true;
        v.playsInline = true;
        v.preload = "metadata";

        if (v.readyState < 1) {
          await wait("loadedmetadata");
        }

        if (cancelled) return;

        const duration = Number.isFinite(v.duration) ? v.duration : 0;
        setDurationSeconds(Math.max(0, Math.floor(duration)));

        const target = Math.min(1, Math.max(0, duration * 0.2));
        if (Number.isFinite(target) && target > 0) {
          v.currentTime = target;
          await wait("seeked");
        }

        if (cancelled) return;

        const w = Math.max(1, v.videoWidth);
        const h = Math.max(1, v.videoHeight);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, w, h);

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/webp", 0.8),
        );

        if (!blob || cancelled) return;

        setThumbnailBlob(blob);
        const preview = URL.createObjectURL(blob);
        setThumbnailPreviewUrl(preview);
      } catch {
        // ignore thumbnail errors
      }
    }

    void makeThumbnail();

    return () => {
      cancelled = true;
    };
  }, [videoPreviewUrl]);

  const fileLabel = useMemo(() => {
    if (!file) return "Aucun fichier sélectionné";
    const duration = durationSeconds === null ? null : formatDuration(durationSeconds);
    return duration ? `${file.name} • ${formatBytes(file.size)} • ${duration}` : `${file.name} • ${formatBytes(file.size)}`;
  }, [file, durationSeconds]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!file) {
      setError("Choisis un fichier vidéo.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.set("title", title);
    form.set("description", asNonEmptyString(description) ?? "");
    form.set("file", file);
    if (typeof durationSeconds === "number") {
      form.set("duration", String(durationSeconds));
    }
    if (thumbnailBlob) {
      form.set("thumbnail", thumbnailBlob, "thumbnail.webp");
    }

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (res.status === 401) {
        router.push("/auth");
        return;
      }

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      const jsonObj = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : null;

      if (!res.ok) {
        if (res.status === 413) {
          const remainingBytes =
            jsonObj && typeof jsonObj.remainingBytes === "number" ? jsonObj.remainingBytes : null;

          setError(
            typeof remainingBytes === "number"
              ? `Stockage VPS plein (reste ${formatBytes(remainingBytes)}).`
              : "Stockage VPS plein.",
          );
          return;
        }

        const apiError = jsonObj && typeof jsonObj.error === "string" ? jsonObj.error : null;
        setError(apiError ?? "Upload impossible.");
        return;
      }

      const videoId = (json as ApiOk | null)?.video?.id;
      if (typeof videoId === "string" && videoId.length > 0) {
        router.push(`/watch/${videoId}`);
        return;
      }

      router.push("/feed");
    } catch {
      setError("Erreur réseau. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">Titre</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-2 h-10 w-full rounded-2xl bg-surface px-3 text-sm text-foreground placeholder:text-muted ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
          placeholder="Titre de la vidéo"
          required
          maxLength={200}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Fichier vidéo</label>
        <div className="mt-2 rounded-2xl bg-surface p-3 ring-1 ring-border">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0] ?? null;
              setFile(f);
            }}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-background file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground hover:file:bg-background/80"
            required
          />
          <div className="mt-2 text-xs text-muted">{fileLabel}</div>
          <div className="mt-1 text-xs text-muted">Limite totale VPS: 1 Go (toutes les vidéos).</div>

          {thumbnailPreviewUrl ? (
            <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-border">
              <Image
                src={thumbnailPreviewUrl}
                alt=""
                width={1280}
                height={720}
                unoptimized
                className="aspect-video w-full object-cover"
              />
            </div>
          ) : null}

          <video ref={videoElRef} className="hidden" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Description (optionnel)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-2 min-h-28 w-full resize-y rounded-2xl bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
          placeholder="Décris ta vidéo..."
          maxLength={5000}
        />
      </div>

      {error ? (
        <div className="rounded-2xl bg-background px-3 py-2 text-sm text-foreground ring-1 ring-border">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-background ring-1 ring-border hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Upload..." : "Uploader"}
      </button>
    </form>
  );
}
