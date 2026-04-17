"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClearNotificationsButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClear() {
    if (disabled || clearing) return;
    if (!confirm("Supprimer toutes les notifications ?")) return;

    setClearing(true);
    setError(null);

    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401) {
        router.push("/auth?next=/notifications");
        return;
      }

      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json && typeof (json as { error?: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Suppression impossible.";
        setError(msg);
        return;
      }

      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? <div className="text-sm text-red-200">{error}</div> : null}
      <button
        type="button"
        onClick={onClear}
        disabled={disabled || clearing}
        className="inline-flex h-9 items-center justify-center rounded-xl bg-surface px-4 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {clearing ? "Suppression..." : "Tout supprimer"}
      </button>
    </div>
  );
}
