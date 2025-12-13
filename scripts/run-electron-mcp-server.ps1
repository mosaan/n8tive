# Wrapper to launch electron-mcp-server with required environment variables.
param(
    [string]$ProjectPath = "."
)

$env:ELECTRON_PROJECT_PATH = $ProjectPath

# Ensure required env vars are present for screenshot encryption and Electron on Windows.
if (-not $env:SCREENSHOT_ENCRYPTION_KEY) {
    $env:SCREENSHOT_ENCRYPTION_KEY = "e7cf9a8f518b560565add20578f1ab579721cf5890b6c82ee13f0fde5247fd65"
}

if (-not $env:SYSTEMROOT) {
    $env:SYSTEMROOT = "C:\Windows"
}

pnpm dlx electron-mcp-server
