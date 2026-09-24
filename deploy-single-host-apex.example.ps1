<#
    Secret-free wrapper for deploying P2S to the drivetodev.online apex domain.
    Provide the FTP, database, and signing-key values through the environment.
    The core script uses RemotePath as both the FTP directory and public host.
#>
$ErrorActionPreference = "Stop"

$requiredEnvironmentVariables = @(
    "P2S_DEPLOY_FTP_SERVER",
    "P2S_DEPLOY_FTP_USERNAME",
    "P2S_DEPLOY_FTP_PASSWORD",
    "P2S_DEPLOY_DB_CONNECTION_STRING",
    "P2S_DEPLOY_JWT_SIGNING_KEY"
)

$missingEnvironmentVariables = @(
    $requiredEnvironmentVariables | Where-Object {
        [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
    }
)

if ($missingEnvironmentVariables.Count -gt 0) {
    throw "Set the required deployment environment variables before running this script: $($missingEnvironmentVariables -join ', ')"
}

$deployParameters = @{
    Server        = $env:P2S_DEPLOY_FTP_SERVER
    Username      = $env:P2S_DEPLOY_FTP_USERNAME
    Password      = $env:P2S_DEPLOY_FTP_PASSWORD
    RemotePath    = "drivetodev.online"
    DbConnStr     = $env:P2S_DEPLOY_DB_CONNECTION_STRING
    JwtSigningKey = $env:P2S_DEPLOY_JWT_SIGNING_KEY
    CorsOrigin    = "https://drivetodev.online"
}

& "$PSScriptRoot\deploy-single-host.core.ps1" @deployParameters
