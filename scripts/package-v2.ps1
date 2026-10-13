param([string]$OutputRoot)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$releaseRoot = if ($OutputRoot) {
  if ([System.IO.Path]::IsPathRooted($OutputRoot)) { $OutputRoot } else { Join-Path $projectRoot $OutputRoot }
} else { Join-Path $projectRoot 'release' }
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
$packageDir = Join-Path $releaseRoot "Still-$version-windows-x64"
$executable = Join-Path $projectRoot 'src-tauri\target\release\still-teleprompter.exe'
if (!(Test-Path -LiteralPath $executable)) { throw 'Run npm run package -- --no-bundle first.' }
New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
Copy-Item -LiteralPath $executable -Destination (Join-Path $packageDir 'Still.exe') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'runtime') -Destination $packageDir -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $packageDir -Force
foreach ($notice in @('LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $notice) -Destination $packageDir -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs') -Destination $packageDir -Recurse -Force
# Clean the single generated root copy from earlier versions of this packaging script.
$oldReportCopy = Join-Path $packageDir 'V2-VALIDATION.md'
if (Test-Path -LiteralPath $oldReportCopy) { Remove-Item -LiteralPath $oldReportCopy }
$files = Get-ChildItem -LiteralPath $packageDir -Recurse -File
$modelHash = (Get-FileHash -LiteralPath (Join-Path $packageDir 'runtime\asr\model.int8.onnx') -Algorithm SHA256).Hash
$sourceHash = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash
if ((Get-FileHash -LiteralPath (Join-Path $packageDir 'Still.exe') -Algorithm SHA256).Hash -ne $sourceHash) { throw 'Executable changed while packaging. Re-run packaging after the build completes.' }
$extractedBytes = ($files | Measure-Object Length -Sum).Sum
if ($extractedBytes -gt 500000000) { throw "Package exceeds 500 MB: $extractedBytes bytes. Required assets were retained." }
$zipPath = Join-Path $releaseRoot "Still-$version-windows-x64.zip"
Compress-Archive -LiteralPath $packageDir -DestinationPath $zipPath -CompressionLevel Optimal -Force
$report = [ordered]@{
  version=$version; extractedBytes=$extractedBytes; zipBytes=(Get-Item -LiteralPath $zipPath).Length;
  executableBytes=(Get-Item -LiteralPath (Join-Path $packageDir 'Still.exe')).Length;
  modelBytes=(Get-Item -LiteralPath (Join-Path $packageDir 'runtime\asr\model.int8.onnx')).Length;
  runtimeBytes=($files | Where-Object {$_.FullName.StartsWith((Join-Path $packageDir 'runtime'))} | Measure-Object Length -Sum).Sum;
  executableSha256=$sourceHash; modelSha256=$modelHash;
  zipSha256=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash;
}
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $releaseRoot "Still-$version-size-report.json") -Encoding utf8
$report | ConvertTo-Json
