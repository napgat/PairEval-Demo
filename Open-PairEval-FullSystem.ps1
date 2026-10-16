param([switch]$NoOpen)
$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
if($env:OS -ne 'Windows_NT' -or ![Environment]::Is64BitOperatingSystem){throw 'The local demo launcher requires Windows x64.'}
if($taskRoot -match '[^\x00-\x7F]'){throw 'Use an English-only path such as C:\PairEvalDemo for the embedded local database.'}
$nodeMajor=& node.exe -p 'process.versions.node.split(String.fromCharCode(46))[0]'
if($LASTEXITCODE -ne 0 -or $nodeMajor -ne '24'){throw 'Use Node.js 24 for this verified local demo.'}
$logRoot=Join-Path $taskRoot '.verification/v20-20261015/launcher'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$nodePath=(Get-Command node.exe).Source
function Test-LocalPort([int]$Port) {
  $client=[System.Net.Sockets.TcpClient]::new()
  try { $operation=$client.ConnectAsync('127.0.0.1',$Port); return ($operation.Wait(300) -and $client.Connected) } catch { return $false } finally { $client.Dispose() }
}
function Wait-LocalPort([int]$Port) {
  for($attempt=0;$attempt -lt 90;$attempt++){if(Test-LocalPort $Port){return};Start-Sleep -Milliseconds 500}
  throw "Local service on port $Port did not become ready. See $logRoot"
}
function Test-OwnedHelper([string]$Name) {
  $file=Join-Path $logRoot "$Name.json"
  if(!(Test-Path -LiteralPath $file)){return $false}
  $prior=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
  $running=Get-Process -Id $prior.id -ErrorAction SilentlyContinue
  return ($running -and $running.StartTime.ToUniversalTime().Ticks -eq ([datetime]$prior.started).ToUniversalTime().Ticks)
}
foreach($service in @(@{port=55432;name='database'},@{port=3101;name='application'},@{port=3103;name='presentation'})){
  if((Test-LocalPort $service.port) -and !(Test-OwnedHelper $service.name)){
    throw "Port $($service.port) is already used outside this checkout's launcher. Stop the other demo from its own folder before opening this one."
  }
}
function Start-Helper([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRoot) {
  $pidFile=Join-Path $logRoot "$Name.json"
  if(Test-Path -LiteralPath $pidFile){
    $prior=Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $running=Get-Process -Id $prior.id -ErrorAction SilentlyContinue
    if($running -and $running.StartTime.ToUniversalTime().Ticks -eq ([datetime]$prior.started).ToUniversalTime().Ticks){return}
  }
  $process=Start-Process -FilePath $nodePath -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot "$Name.out.log") -RedirectStandardError (Join-Path $logRoot "$Name.err.log")
  @{id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $pidFile
}
if(!(Test-Path -LiteralPath (Join-Path $taskRoot '.next/BUILD_ID'))){throw 'The verified application build is missing. Run npm ci and npm run build in this folder.'}
if(!(Test-LocalPort 55432)){
  if(!(Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules/embedded-postgres/package.json'))){throw 'The local database runtime is missing. Run npm ci in this folder.'}
  Start-Helper 'database' @('scripts/local-database-helper.mjs')
  Wait-LocalPort 55432
  Start-Sleep -Milliseconds 500
}
Push-Location $taskRoot
try { & $nodePath 'scripts/wait-local-database.mjs'; if($LASTEXITCODE -ne 0){throw 'Local database not ready'}; & $nodePath 'scripts/full-system-db.mjs' 'migrate'; if($LASTEXITCODE -ne 0){throw 'Database migration failed'}; & $nodePath 'scripts/full-system-db.mjs' 'seed'; if($LASTEXITCODE -ne 0){throw 'Database seed marker failed'} } finally { Pop-Location }
if(!(Test-LocalPort 3101)){
  Start-Helper 'application' @('node_modules/next/dist/bin/next','start','--port','3101','--hostname','127.0.0.1')
  Wait-LocalPort 3101
}
if(!(Test-LocalPort 3103)){
  Start-Helper 'presentation' @('scripts/local-demo-portal.mjs')
  Wait-LocalPort 3103
}
Start-Helper 'jobs' @('scripts/job-worker.mjs')
Write-Host 'PairEval PRD v2.0 presentation: http://localhost:3103'
Write-Host 'Synthetic local data only. Services and encrypted backups run on this laptop.'
if(!$NoOpen){Start-Process 'http://localhost:3103'}
