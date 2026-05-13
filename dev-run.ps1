$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$pemPath = Join-Path $repoRoot "dashboard-2.pem"
$backendPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$npmCmd = Join-Path $env:SystemRoot "System32\cmd.exe"
$logDir = Join-Path $repoRoot ".dev-logs"
$backendPort = 8000
$frontendPort = 5173
$sessionId = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not (Test-Path $pemPath)) {
    throw "Missing PEM file at: $pemPath"
}
if (-not (Test-Path $backendPython)) {
    throw "Missing backend venv python at: $backendPython"
}
if (-not (Test-Path $frontendDir)) {
    throw "Missing frontend directory at: $frontendDir"
}
if (-not (Test-Path $npmCmd)) {
    throw "Missing cmd.exe at: $npmCmd"
}

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$processes = @()
$jobs = @()

function Wait-LocalPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 20
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
        if ($listener) {
            return
        }
        Start-Sleep -Milliseconds 300
    }
    throw "Port $Port did not start listening within $TimeoutSeconds seconds."
}

function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $stdout = Join-Path $logDir "$sessionId.$Name.out.log"
    $stderr = Join-Path $logDir "$sessionId.$Name.err.log"
    "" | Set-Content $stdout
    "" | Set-Content $stderr

    $proc = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru `
        -WindowStyle Hidden

    $tailOutJob = Start-Job -ScriptBlock {
        param($Path, $Tag)
        Get-Content -Path $Path -Wait -Tail 5 | ForEach-Object { "[{0}] {1}" -f $Tag, $_ }
    } -ArgumentList $stdout, $Name

    $tailErrJob = Start-Job -ScriptBlock {
        param($Path, $Tag)
        Get-Content -Path $Path -Wait -Tail 5 | ForEach-Object { "[{0}] {1}" -f $Tag, $_ }
    } -ArgumentList $stderr, "$Name ERR"

    $script:processes += $proc
    $script:jobs += $tailOutJob
    $script:jobs += $tailErrJob

    Write-Host "Started $Name (PID: $($proc.Id))"
}

function Cleanup-All {
    Write-Host "`nStopping dev stack..."

    foreach ($job in $jobs) {
        try { Stop-Job -Job $job -ErrorAction SilentlyContinue | Out-Null } catch {}
        try { Remove-Job -Job $job -Force -ErrorAction SilentlyContinue | Out-Null } catch {}
    }

    foreach ($proc in $processes) {
        try {
            if (-not $proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
}

try {
    $busy = Get-NetTCPConnection -State Listen -LocalPort $backendPort -ErrorAction SilentlyContinue
    if ($busy) {
        $backendPort = 8001
        Write-Host "Port 8000 is already in use; switching backend to port $backendPort for this dev session."
    }

    Write-Host "Starting SSH tunnels..."
    Start-ManagedProcess `
        -Name "tunnel-rest" `
        -FilePath "ssh" `
        -Arguments @(
            "-o", "ExitOnForwardFailure=yes",
            "-o", "ServerAliveInterval=30",
            "-o", "StrictHostKeyChecking=no",
            "-i", "`"$pemPath`"",
            "-N",
            "-L", "54321:localhost:54321",
            "ubuntu@3.110.30.9"
        ) `
        -WorkingDirectory $repoRoot

    Start-ManagedProcess `
        -Name "tunnel-db" `
        -FilePath "ssh" `
        -Arguments @(
            "-o", "ExitOnForwardFailure=yes",
            "-o", "ServerAliveInterval=30",
            "-o", "StrictHostKeyChecking=no",
            "-i", "`"$pemPath`"",
            "-N",
            "-L", "15432:localhost:5432",
            "ubuntu@13.233.254.107"
        ) `
        -WorkingDirectory $repoRoot

    Wait-LocalPort -Port 54321 -TimeoutSeconds 25
    Wait-LocalPort -Port 15432 -TimeoutSeconds 25
    Write-Host "Tunnels are up."

    Write-Host "Starting backend..."
    Start-ManagedProcess `
        -Name "backend" `
        -FilePath $backendPython `
        -Arguments @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$backendPort", "--reload") `
        -WorkingDirectory $backendDir

    Wait-LocalPort -Port $backendPort -TimeoutSeconds 25
    Write-Host "Backend is up at http://127.0.0.1:$backendPort"

    Write-Host "Starting frontend..."
    Start-ManagedProcess `
        -Name "frontend" `
        -FilePath $npmCmd `
        -Arguments @("/c", "npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "$frontendPort") `
        -WorkingDirectory $frontendDir

    Write-Host "Frontend target: http://127.0.0.1:$frontendPort"
    Write-Host "Press Ctrl+C to stop everything."

    while ($true) {
        foreach ($job in $jobs) {
            $lines = Receive-Job -Job $job -ErrorAction SilentlyContinue
            if ($lines) {
                foreach ($line in $lines) {
                    Write-Host $line
                }
            }
        }
        Start-Sleep -Milliseconds 200
    }
}
finally {
    Cleanup-All
}
