export default async function ChannelByUsernamePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Channel</h1>
      <p className="mt-2 text-muted">
        Chaîne utilisateur (username): <span className="font-medium">{username}</span>
      </p>
    </div>
  );
}
