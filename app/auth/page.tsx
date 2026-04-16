import { Suspense } from "react";

import { AuthPanel } from "@/components/auth/panel";

export default function AuthPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-2 text-sm text-muted">
        Connecte-toi ou crée un compte pour utiliser WatchTube.
      </p>

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="rounded-2xl bg-surface p-4 ring-1 ring-border">
              <div className="text-sm text-muted">Chargement…</div>
            </div>
          }
        >
          <AuthPanel />
        </Suspense>
      </div>
    </div>
  );
}
