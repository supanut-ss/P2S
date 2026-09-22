# Single-host deployment

The repository keeps deployment behavior and machine credentials separate:

- `deploy-single-host.core.ps1` is the shared, tracked deployment workflow.
- `deploy-single-host.example.ps1` is the tracked, secret-free local wrapper example.
- `deploy-single-host.ps1` is the Git-ignored wrapper used on each deployment machine.
- `upload-ftp.ps1` is the shared FTP uploader called by the core workflow (copied
  unchanged from the EA repo — it's generic and carries no EA-specific references).

Adapted from EA's proven single-host deploy for the same Plesk host (per
PROJECT-PLAN.md section 6). The `win-x86` self-contained publish RID in
`deploy-single-host.core.ps1` carries over EA's host assumption (32-bit IIS
app pool) **unverified for P2S's app pool** — confirm before the first real
deploy.

## Set up a new machine

1. Install Node.js/npm and the .NET 8 SDK.
2. Copy the example wrapper:

   ```powershell
   Copy-Item .\deploy-single-host.example.ps1 .\deploy-single-host.ps1
   ```

3. Set the required environment variables for the current PowerShell session:

   ```powershell
   $env:P2S_DEPLOY_FTP_SERVER = "ftp.example.com"
   $env:P2S_DEPLOY_FTP_USERNAME = "your-ftp-user"
   $env:P2S_DEPLOY_FTP_PASSWORD = "your-ftp-password"
   $env:P2S_DEPLOY_REMOTE_PATH = "site.example.com"
   $env:P2S_DEPLOY_DB_CONNECTION_STRING = "Server=...;Database=...;User=...;Password=...;"
   $env:P2S_DEPLOY_JWT_SIGNING_KEY = "a long random production signing key — never reuse the local dev one"
   ```

   `P2S_DEPLOY_CORS_ORIGIN` is optional. When omitted, the core script uses
   `https://<P2S_DEPLOY_REMOTE_PATH>`.

4. Run the local wrapper:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy-single-host.ps1
   ```

Do not add real values to `deploy-single-host.example.ps1`, the core script, or
any other tracked file. The generated `deploy/` directory contains a patched
`web.config` with runtime secrets and is also Git-ignored.

## Success criteria

A deployment is successful only when the frontend and backend builds pass,
every required upload verifies, `app_offline.htm` is removed, and `/health`
returns HTTP 200. When upload or health verification fails, the script exits
non-zero and keeps or restores maintenance mode.

## Not yet run for real

This script has not been executed against the actual Plesk host — there is no
FTP server, remote path, or production database to test against yet. Treat it
as reviewed-but-unverified until the first real deployment confirms the
win-x86 publish RID, the web.config patching, and the health-check URL all
work against P2S's actual hosting environment.
