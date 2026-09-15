param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$gameRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$gameUrl='http://127.0.0.1:5180'
$alreadyRunning=$false
try { $health=Invoke-RestMethod "$gameUrl/__neon_health" -TimeoutSec 2; $alreadyRunning=$health.app -eq 'neon-requiem-three' } catch {}
if (-not $alreadyRunning) {
 $nodeCommand=Get-Command node -ErrorAction SilentlyContinue
 if (-not $nodeCommand) { throw 'Node.js is required to start the local game. Install Node.js 22 or later, then launch again.' }
 $serverPath=Join-Path $gameRoot 'serve.mjs'
 if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'index.html'))) { throw 'The game files are missing. Keep this launcher beside index.html.' }
 $process=Start-Process -FilePath $nodeCommand.Source -ArgumentList @(('"' + $serverPath + '"')) -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $gameRoot 'server.log') -RedirectStandardError (Join-Path $gameRoot 'server-error.log') -PassThru
 for ($attempt=0;$attempt -lt 30;$attempt++) {
  Start-Sleep -Milliseconds 200
  try { $health=Invoke-RestMethod "$gameUrl/__neon_health" -TimeoutSec 1; if ($health.app -eq 'neon-requiem-three') { $alreadyRunning=$true; break } } catch {}
  if ($process.HasExited) { break }
 }
 if (-not $alreadyRunning) { throw 'The local game server could not start. Check server-error.log. Port 5180 may be in use.' }
}
if (-not $NoBrowser) { Start-Process $gameUrl }
