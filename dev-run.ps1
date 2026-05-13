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
        [string]$WorkingDirectory,
        [hashtable]$Environment = @{}
    )

    $stdout = Join-Path $logDir "$sessionId.$Name.out.log"
    $stderr = Join-Path $logDir "$sessionId.$Name.err.log"
    "" | Set-Content $stdout
    "" | Set-Content $stderr

    $startParams = @{
        FilePath = $FilePath
        ArgumentList = $Arguments
        WorkingDirectory = $WorkingDirectory
        RedirectStandardOutput = $stdout
        RedirectStandardError = $stderr
        PassThru = $true
        WindowStyle = "Hidden"
    }

    $previousEnv = @{}
    if ($Environment.Count -gt 0) {
        foreach ($key in $Environment.Keys) {
            $previousEnv[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
            [Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], "Process")
        }
    }

    try {
        $proc = Start-Process @startParams
    } finally {
        if ($Environment.Count -gt 0) {
            foreach ($key in $Environment.Keys) {
                [Environment]::SetEnvironmentVariable($key, $previousEnv[$key], "Process")
            }
        }
    }

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

function Stop-StaleDevProcesses {
    param([int]$BackendPortToUse)

    $portsToCheck = @(5173, 5174, 5175, 5176, 5177, 54321, 15432, 8000, 8001, $BackendPortToUse)
    $listenerPids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -in $portsToCheck } |
        Select-Object -ExpandProperty OwningProcess -Unique

    $candidatePids = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -match "vite --host 127\.0\.0\.1 --port 5173" -or
                $_.CommandLine -match "uvicorn app\.main:app" -or
                $_.CommandLine -match "dashboard-2\.pem" -or
                $_.CommandLine -match "Ascent Dashboard\\backend"
            )
        } |
        Select-Object -ExpandProperty ProcessId

    $targets = @($listenerPids + $candidatePids | Sort-Object -Unique)
    foreach ($targetPid in $targets) {
        if (-not $targetPid -or $targetPid -eq $PID) { continue }
        try { Stop-Process -Id $targetPid -Force -ErrorAction Stop } catch {}
    }
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

    Stop-StaleDevProcesses -BackendPortToUse $backendPort

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

    $leaderboardUrl = "http://127.0.0.1:$backendPort/api/v1/users/me/leaderboard"
    try {
        Invoke-WebRequest -Uri $leaderboardUrl -Method GET -UseBasicParsing -TimeoutSec 6 | Out-Null
        Write-Host "Leaderboard route check: OK"
    } catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            Write-Host "Leaderboard route check: OK (auth required)"
        } elseif ($statusCode -eq 404) {
            Write-Warning "Leaderboard route check failed with 404. Backend code may be outdated."
        } else {
            Write-Host "Leaderboard route check: unable to verify (status: $statusCode)"
        }
    }

    $envLocalPath = Join-Path $frontendDir ".env.local"
    "BACKEND_URL=http://127.0.0.1:$backendPort" | Set-Content $envLocalPath

    Write-Host "Starting frontend..."
    Start-ManagedProcess `
        -Name "frontend" `
        -FilePath $npmCmd `
        -Arguments @("/c", "npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "$frontendPort", "--strictPort") `
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
