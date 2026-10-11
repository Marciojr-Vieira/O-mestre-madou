param([ValidateSet('setup','dev','api','web','worker','check','test','lint','typecheck','build','sync-catalog','db-up','db-down','db-migrate','db-verify','test-postgres','import-local','netlify-env')][string]$Target='dev')
$ErrorActionPreference='Stop'
$projectRoot=$PSScriptRoot
Set-Location -LiteralPath $projectRoot
$portableNode=Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portableNode) { $env:PATH=$portableNode.FullName+';'+$env:PATH }
$portablePnpm=Join-Path $projectRoot '.tools/pnpm/pnpm.cmd'
if(Test-Path -LiteralPath $portablePnpm){$env:PATH=(Split-Path -Parent $portablePnpm)+';'+$env:PATH}
$packageRunner=if(Test-Path -LiteralPath $portablePnpm){$portablePnpm}else{'pnpm.cmd'}
if($Target -eq 'setup') {
  if(!(Test-Path -LiteralPath '.env')){Copy-Item -LiteralPath '.env.example' -Destination '.env'}
  & $packageRunner install --store-dir .tools/pnpm-store
} elseif($Target -eq 'db-up') { docker compose up -d --wait }
elseif($Target -eq 'db-down') { docker compose down }
else { & $packageRunner $Target }
exit $LASTEXITCODE
