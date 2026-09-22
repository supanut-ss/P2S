# P2S Inventory — repo notes for Claude Code

Full requirement/data-model/workflow context lives in [PROJECT-PLAN.md](PROJECT-PLAN.md) — read that first. This file is operational notes for working in the repo, not a design doc.

## Repo identity

This repo **is** the project. `PROJECT-PLAN.md`'s original draft named the folder `P2SInventory` — that was never created; everything lives here at `D:\GitSource\P2S`. Namespace/solution name is `P2S`, not `P2SInventory`.

## .NET SDK pin — don't remove global.json

This machine has SDK 10.0.401 installed alongside 8.0.206. [global.json](global.json) pins the repo to 8.0.206 because the target production host (same Plesk instance as the `EA` repo) only proves out `net8.0` + Pomelo 8.0.2. Without the pin, `dotnet new`/`dotnet build` silently pick up net10 and the app may not deploy. If you ever intentionally move to a newer TFM, update global.json, all `.csproj` TargetFramework values, and re-verify the EF package versions stay mutually compatible (see the version-alignment note below).

## EF Core package version alignment

`Pomelo.EntityFrameworkCore.MySql` is pinned at 8.0.2 (matches EA's Plesk-proven version). `Microsoft.EntityFrameworkCore.Design` (API project) and `Microsoft.EntityFrameworkCore.InMemory` (test project) are deliberately pinned to the **same 8.0.2**, not the latest 8.0.x — bumping either alone reintroduces an `MSB3277` assembly version conflict warning between the test project's `ProjectReference` to `P2S.Api` and its own EF packages. If you add a new EF-related package, check it doesn't drag in a different 8.0.x patch.

## Local dev setup

Backend needs a MySQL connection string and a JWT signing key — neither is in `appsettings.json` (no secrets committed). Set them once via user-secrets:

```powershell
cd Backend/P2S.Api
dotnet user-secrets set "ConnectionStrings:P2S" "Server=127.0.0.1;Port=3306;Database=p2s_dev;User=root;Password=devpassword;"
dotnet user-secrets set "Jwt:SigningKey" "<any long random string for local dev>"
```

Local MySQL via Docker (used throughout Phase 1-3 development and verification):

```bash
docker run -d --name p2s-mysql -e MYSQL_ROOT_PASSWORD=devpassword -e MYSQL_DATABASE=p2s_dev -p 3306:3306 mysql:8.0
```

Apply migrations (the `dotnet-ef` global tool on this machine isn't on PATH by default — invoke it directly, or add `~/.dotnet/tools` to PATH):

```bash
cd Backend/P2S.Api
~/.dotnet/tools/dotnet-ef.exe database update
```

Run backend (must set `ASPNETCORE_ENVIRONMENT=Development` explicitly when using `--no-launch-profile` — user secrets otherwise won't load and the app throws on the missing connection string):

```bash
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS="http://localhost:5080" dotnet run --no-launch-profile
```

Run frontend — `.claude/launch.json` has a `frontend-dev` config wired to `npm --prefix Frontend run dev`, so the Browser tool's `preview_start` can launch it directly. Vite's dev proxy forwards `/api` and `/health` to `localhost:5080`, so the backend must already be running.

Seeded login: `admin` / `ChangeMe123!` — rotate via `POST /api/auth/admin-reset-password` (admin-only, since there's no email-based self-serve reset by design).

## Design tokens — two copies, one source of truth

[design/tokens.css](design/tokens.css) / [design/tokens.json](design/tokens.json) are the source of truth. [Frontend/src/theme/tokens.css](Frontend/src/theme/tokens.css) and [Frontend/src/theme/tokens.ts](Frontend/src/theme/tokens.ts) are hand-synced copies (tokens.ts exists because MUI's `createTheme()` needs concrete values at construction time, not CSS custom properties). If you change a color in `design/`, update both frontend copies and re-check [design/style-guide.html](design/style-guide.html) and [design/mockup-inventory.html](design/mockup-inventory.html) too — nothing regenerates these automatically.

## Testing

```bash
dotnet test Backend/P2S.Api.Tests/P2S.Api.Tests.csproj
```

8 tests as of Phase 3, all using EF Core's InMemory provider (remember to call `context.Database.EnsureCreated()` in test setup — HasData seed rows don't materialize otherwise). One test (`ComputeAndSaveAsync_SumsOnlyOrdersPlacedOnTheBusinessDate`) exercises the Asia/Bangkok midnight boundary specifically — don't remove it, that's the exact edge case a date-scoped query gets wrong first.

When testing anything decimal-money-related against a *real* MySQL connection (not InMemory), watch for the precision trap already hit once: `SUM(int_column * decimal(18,2)_column)` in MySQL widens to `decimal(65,30)`, and if you read that value straight off an entity after `SaveChangesAsync()` (rather than re-querying), the oversized scale leaks past the column's `HasPrecision(18,2)` truncation. Round explicitly before assigning — see `DailyFinanceSnapshotService` for the pattern.

## Deploy scripts — not yet run for real

`deploy-single-host.core.ps1` / `.example.ps1` / `upload-ftp.ps1` are adapted from the `EA` repo's proven scripts but have never executed against a real FTP/Plesk target. The `win-x86` self-contained publish RID is an unverified assumption carried over from EA's host. Confirm before first real use — see [DEPLOYMENT-SINGLE-HOST.md](DEPLOYMENT-SINGLE-HOST.md).

## What's not built yet

Business controllers (Orders, Reimbursements, Deliveries, Inventory, Cancellations, Master data) and their corresponding frontend screens are placeholders only. `AuthController` and `FinanceController` are the only real API surface so far. See PROJECT-PLAN.md section 4 for per-screen status.
