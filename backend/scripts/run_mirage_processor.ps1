$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$python = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"
$requirements = Join-Path $repoRoot "processor\requirements.txt"
$logDir = Join-Path $repoRoot "processor\logs"
$stdoutLog = Join-Path $logDir "mirage-processor.out.log"
$stderrLog = Join-Path $logDir "mirage-processor.err.log"

if (-not (Test-Path $python)) {
    throw "Python runtime not found at $python"
}

if (-not (Test-Path $requirements)) {
    throw "Processor requirements file not found at $requirements"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$env:PYTHONPATH = $repoRoot
Set-Location $repoRoot

$importProbe = Join-Path $PSScriptRoot "mirage_processor_import_probe.py"

& $python $importProbe | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing Mirage processor dependencies into $python ..."
    & $python -m pip install --upgrade --force-reinstall --no-cache-dir -r $requirements
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install Mirage processor dependencies."
    }
}

$command = if ($args.Count -gt 0) { $args[0] } else { "poll-once" }
$extraArgs = if ($args.Count -gt 1) { $args[1..($args.Count - 1)] } else { @() }

Write-Host "Running Mirage processor command: $command $($extraArgs -join ' ')"
Write-Host "Stdout log: $stdoutLog"
Write-Host "Stderr log: $stderrLog"

$combinedLog = Join-Path $logDir "mirage-processor.run.log"
& $python -m processor.mirage_processor $command @extraArgs *> $combinedLog
$exitCode = $LASTEXITCODE

Write-Host "Processor exit code: $exitCode"
if ($exitCode -ne 0) {
    exit $exitCode
}
exit $exitCode
