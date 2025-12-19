# Load GitHub token from .env file
# Usage: . .\scripts\set-gh-token.ps1

$envFile = Join-Path $PSScriptRoot ".." ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "Error: .env file not found" -ForegroundColor Red
    Write-Host "Please create .env file based on .env.example" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Steps:" -ForegroundColor Cyan
    Write-Host "  1. Copy .env.example to .env" -ForegroundColor White
    Write-Host "  2. Edit .env and set your GitHub token" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
    exit 1
}

# Read .env file and set environment variables
Get-Content $envFile | ForEach-Object {
    # Skip comments and empty lines
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
        return
    }

    # Parse KEY=VALUE format
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()

        # Remove quotes if present
        $value = $value -replace '^["'']|["'']$', ''

        # Set environment variable
        Set-Item -Path "env:$key" -Value $value
        Write-Host "✓ Loaded $key" -ForegroundColor Green
    }
}

# Verify GH_TOKEN is set
if (-not $env:GH_TOKEN) {
    Write-Host "Warning: GH_TOKEN is not set in .env file" -ForegroundColor Yellow
    exit 1
}

if ($env:GH_TOKEN -eq "ghp_your_token_here") {
    Write-Host "Warning: GH_TOKEN is still the placeholder value" -ForegroundColor Yellow
    Write-Host "Please edit .env and set your actual GitHub token" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "GitHub token loaded successfully!" -ForegroundColor Green
Write-Host "You can now run: pnpm package:publish" -ForegroundColor Cyan
