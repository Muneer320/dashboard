$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$python = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"
$logDir = Join-Path $repoRoot "processor\logs"
$stdoutLog = Join-Path $logDir "mirage-processor-server.out.log"
$stderrLog = Join-Path $logDir "mirage-processor-server.err.log"

if (-not (Test-Path $python)) {
    throw "Python runtime not found at $python"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$backendRoot = Join-Path $repoRoot "backend"
$env:PYTHONPATH = "$backendRoot;$repoRoot"
# PowerShell on Windows can surface both Path and PATH in the environment
# provider, which makes Start-Process throw on redirected launches.
if (Test-Path Env:PATH) {
    Remove-Item Env:PATH -ErrorAction SilentlyContinue
}
$existing = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $pids = @($existing | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($processId in $pids) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Stopped existing Mirage processor process on port 8765 (PID $processId)"
        } catch {
            Write-Warning "Could not stop existing process on port 8765 (PID $processId): $($_.Exception.Message)"
        }
    }
    Start-Sleep -Seconds 1
}

Start-Process `
    -FilePath $python `
    -ArgumentList "-m", "processor.mirage_processor", "serve" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden

Write-Host "Started Mirage processor server on http://127.0.0.1:8765"
Write-Host "Stdout log: $stdoutLog"
Write-Host "Stderr log: $stderrLog"
