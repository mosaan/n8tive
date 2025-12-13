# Simple MCP handshake test using PowerShell.
# Starts the electron MCP server (via wrapper) and performs:
#   initialize -> list_tools
# Outputs responses and exits.

$scriptPath = Join-Path -Path (Get-Location) -ChildPath "scripts/run-electron-mcp-server.ps1"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell"
$psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$null = $proc.Start()

$stdout = $proc.StandardOutput
$stdin = $proc.StandardInput
$stderr = $proc.StandardError

# Send initialize request
$stdin.WriteLine('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}')
$initialized = $false
$listed = $false
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

while (-not $proc.HasExited -and $stopwatch.ElapsedMilliseconds -lt 8000) {
    # Read stdout lines
    while (-not $stdout.EndOfStream) {
        $line = $stdout.ReadLine()
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $msg = $line | ConvertFrom-Json
            Write-Host "<<" ($msg | ConvertTo-Json -Depth 5 -Compress)
            if (-not $initialized -and $msg.id -eq 1 -and $msg.result) {
                $initialized = $true
                $stdin.WriteLine('{"jsonrpc":"2.0","id":2,"method":"list_tools","params":{}}')
            } elseif (-not $listed -and $msg.id -eq 2 -and $msg.result) {
                $listed = $true
                Write-Host "Tools:" ($msg.result.tools | ConvertTo-Json -Depth 5 -Compress)
                $proc.Kill()
                break
            }
        } catch {
            Write-Host "log:" $line
        }
    }
    Start-Sleep -Milliseconds 50
}

if (-not $listed) {
    while (-not $stderr.EndOfStream) {
        Write-Host "stderr:" $stderr.ReadLine()
    }
    if ($proc.HasExited) {
        Write-Host "Process exited with code" $proc.ExitCode
    } else {
        Write-Host "Timeout waiting for list_tools; terminating process."
        $proc.Kill()
    }
}
