export default async function ChannelByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Channel</h1>
      <p className="mt-2 text-muted">
        Chaîne utilisateur (id): <span className="font-medium">{id}</span>
      </p>
    </div>
  );
}
