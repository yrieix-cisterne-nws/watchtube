import { redirect } from "next/navigation";

import { CreateVideoForm } from "@/components/videos/create-video-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function UploadPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/auth");
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Créer une vidéo</h1>
      <p className="mt-2 text-sm text-muted">
        Ajoute les infos de ta vidéo pour la publier sur WatchTube.
      </p>

      <div className="mt-6">
        <CreateVideoForm />
      </div>
    </div>
  );
}
