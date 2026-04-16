"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Mode = "login" | "register";

type ApiError = { error?: string };

function parseErrorMessage(input: unknown): string {
  if (typeof input === "string") return input;
  if (typeof input !== "object" || input === null) return "Erreur";
  const obj = input as Record<string, unknown>;
  if (typeof obj.error === "string") return obj.error;
  return "Erreur";
}

function safeNextPath(input: string | null): string {
  if (!input) return "/feed";
  if (!input.startsWith("/")) return "/feed";
  if (input.startsWith("//")) return "/feed";
  if (input.includes("://")) return "/feed";
  if (input.includes("\\")) return "/feed";
  return input;
}

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    return mode === "login" ? "Se connecter" : "Créer un compte";
  }, [mode]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            mode === "login"
              ? {
                  identifier: String(form.get("identifier") ?? ""),
                  password: String(form.get("password") ?? ""),
                }
              : {
                  username: String(form.get("username") ?? ""),
                  email: String(form.get("email") ?? ""),
                  password: String(form.get("password") ?? ""),
                },
          ),
        },
      );

      if (!res.ok) {
        const json: ApiError | unknown = await res.json().catch(() => ({}));
        setError(parseErrorMessage(json));
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-border">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={
            mode === "login"
              ? "h-9 flex-1 rounded-xl bg-background text-sm font-semibold text-foreground ring-1 ring-border"
              : "h-9 flex-1 rounded-xl text-sm text-muted hover:bg-background/60"
          }
        >
          Connexion
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={
            mode === "register"
              ? "h-9 flex-1 rounded-xl bg-background text-sm font-semibold text-foreground ring-1 ring-border"
              : "h-9 flex-1 rounded-xl text-sm text-muted hover:bg-background/60"
          }
        >
          Inscription
        </button>
      </div>

      <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>

      {error ? (
        <div className="mt-3 rounded-xl bg-background p-3 text-sm text-foreground ring-1 ring-border">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        {mode === "register" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Username</span>
              <input
                name="username"
                autoComplete="username"
                className="h-10 rounded-xl bg-background px-3 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
                placeholder=""
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="h-10 rounded-xl bg-background px-3 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
                placeholder=""
                required
              />
            </label>
          </>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">
              Email ou username
            </span>
            <input
              name="identifier"
              autoComplete="username"
              className="h-10 rounded-xl bg-background px-3 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
              placeholder=""
              required
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted">Mot de passe</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="h-10 rounded-xl bg-background px-3 text-sm text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
            placeholder=""
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 inline-flex h-10 items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background ring-1 ring-border hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "En cours..." : title}
        </button>
      </form>
    </div>
  );
}
