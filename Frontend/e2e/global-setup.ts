/**
 * Fails the whole run immediately with an actionable message if the backend isn't up,
 * instead of every test individually timing out against a dead API 30s at a time — the
 * failure mode that actually happens when someone runs `npm run test:e2e` without first
 * starting the backend/MySQL per CLAUDE.md.
 */
export default async function globalSetup() {
  const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://localhost:5080';

  try {
    const res = await fetch(`${backendUrl}/health`);
    if (!res.ok) throw new Error(`unexpected status ${res.status}`);
  } catch (err) {
    throw new Error(
      `Backend not reachable at ${backendUrl}/health — start it first (see CLAUDE.md "Local dev setup": ` +
        `Docker MySQL, then \`ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS="http://localhost:5080" dotnet run --no-launch-profile\` ` +
        `from Backend/P2S.Api). Underlying error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
