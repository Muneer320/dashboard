$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$python = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"
$requirements = Join-Path $repoRoot "processor\requirements.txt"
$logDir = Join-Path $repoRoot "processor\logs"
$stdoutLog = Join-Path $logDir "mirage-processor-server.out.log"
$stderrLog = Join-Path $logDir "mirage-processor-server.err.log"

if (-not (Test-Path $python)) {
    throw "Python runtime not found at $python"
}

if (-not (Test-Path $requirements)) {
    throw "Processor requirements file not found at $requirements"
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

$importProbe = Join-Path $PSScriptRoot "mirage_processor_import_probe.py"

& $python $importProbe | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing Mirage processor dependencies into $python ..."
    & $python -m pip install --upgrade --force-reinstall --no-cache-dir -r $requirements
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install Mirage processor dependencies."
    }
}

Remove-Item $stdoutLog,$stderrLog -ErrorAction SilentlyContinue

Start-Process `
    -FilePath $python `
    -ArgumentList "-m", "processor.mirage_processor", "serve" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8765/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            Write-Host "Started Mirage processor server on http://127.0.0.1:8765"
            Write-Host "Stdout log: $stdoutLog"
            Write-Host "Stderr log: $stderrLog"
            exit 0
        }
    } catch {
        # keep polling until timeout so we can surface the real startup error
    }
}

if (Test-Path $stderrLog) {
    Write-Host "Mirage processor stderr:"
    Get-Content $stderrLog -Tail 80 | Out-Host
}
if (Test-Path $stdoutLog) {
    Write-Host "Mirage processor stdout:"
    Get-Content $stdoutLog -Tail 40 | Out-Host
}

throw "Mirage processor failed to start on http://127.0.0.1:8765"
