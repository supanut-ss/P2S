<#
    Copy this file to deploy-single-host.ps1, then provide the six required
    P2S_DEPLOY_* environment variables on that machine. deploy-single-host.ps1
    is Git-ignored; never put real credentials in this example file.
#>

$ErrorActionPreference = "Stop"

$requiredEnvironmentVariables = @(
    "P2S_DEPLOY_FTP_SERVER",
    "P2S_DEPLOY_FTP_USERNAME",
    "P2S_DEPLOY_FTP_PASSWORD",
    "P2S_DEPLOY_REMOTE_PATH",
    "P2S_DEPLOY_DB_CONNECTION_STRING",
    "P2S_DEPLOY_JWT_SIGNING_KEY"
)

$missingVariables = @(
    foreach ($name in $requiredEnvironmentVariables) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
            $name
        }
    }
)

if ($missingVariables.Count -gt 0) {
    throw "Missing required deployment environment variables: $($missingVariables -join ', ')"
}

$deployParameters = @{
    Server        = $env:P2S_DEPLOY_FTP_SERVER
    Username      = $env:P2S_DEPLOY_FTP_USERNAME
    Password      = $env:P2S_DEPLOY_FTP_PASSWORD
    RemotePath    = $env:P2S_DEPLOY_REMOTE_PATH
    DbConnStr     = $env:P2S_DEPLOY_DB_CONNECTION_STRING
    JwtSigningKey = $env:P2S_DEPLOY_JWT_SIGNING_KEY
}

if (-not [string]::IsNullOrWhiteSpace($env:P2S_DEPLOY_CORS_ORIGIN)) {
    $deployParameters.CorsOrigin = $env:P2S_DEPLOY_CORS_ORIGIN
}

& "$PSScriptRoot\deploy-single-host.core.ps1" @deployParameters
