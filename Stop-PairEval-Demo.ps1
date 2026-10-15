$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
$logRoot=Join-Path $taskRoot '.verification/v20-20261015/launcher'
function Stop-Tracked([string]$Name) {
 $file=Join-Path $logRoot "$Name.json"
 if(!(Test-Path -LiteralPath $file)){return}
 $info=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
 $running=Get-Process -Id $info.id -ErrorAction SilentlyContinue
 if($running -and $running.StartTime.ToUniversalTime().Ticks -eq ([datetime]$info.started).ToUniversalTime().Ticks){Stop-Process -Id $info.id}
}
foreach($name in @('jobs','presentation','application')){Stop-Tracked $name}
$databaseFile=Join-Path $logRoot 'database.json'
if(Test-Path -LiteralPath $databaseFile){
 $info=Get-Content -LiteralPath $databaseFile -Raw|ConvertFrom-Json
 $running=Get-Process -Id $info.id -ErrorAction SilentlyContinue
 if($running -and $running.StartTime.ToUniversalTime().Ticks -eq ([datetime]$info.started).ToUniversalTime().Ticks){
  $envFile=Get-Content -LiteralPath (Join-Path $taskRoot '.env.local')
  $dataLine=$envFile|Where-Object{$_ -like 'PAIR_EVAL_LOCAL_PGDATA=*'}|Select-Object -First 1
  $dataDirectory=$dataLine.Substring('PAIR_EVAL_LOCAL_PGDATA='.Length)
  $pgctl=Join-Path $taskRoot 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'
  if(!(Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))){throw 'Configured local database directory is invalid'}
  & $pgctl '-D' $dataDirectory 'stop' '-m' 'fast' '-w'
  if($LASTEXITCODE -ne 0){throw 'Local PostgreSQL did not shut down cleanly'}
  Stop-Tracked 'database'
 }
}
Write-Host 'Tracked PairEval presentation services stopped. All data and backups were preserved.'
