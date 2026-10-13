param(
  [Parameter(Mandatory=$true)][string]$SourceRuntime,
  [string]$SourceLicenses
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$source = (Resolve-Path -LiteralPath $SourceRuntime).Path
$destination = Join-Path $projectRoot 'runtime'
foreach ($relative in @('python\python.exe','asr\model.int8.onnx','asr\tokens.txt','python\Lib\site-packages\sherpa_onnx\lib\onnxruntime.dll')) {
  if (!(Test-Path -LiteralPath (Join-Path $source $relative))) { throw "Missing ASR resource: $relative" }
}
# Copy only from the supplied source. Never execute or modify the VoiceFlow project.
Copy-Item -LiteralPath (Join-Path $source 'python') -Destination $destination -Recurse -Force
foreach ($file in @('model.int8.onnx','tokens.txt')) {
  Copy-Item -LiteralPath (Join-Path $source "asr\$file") -Destination (Join-Path $destination "asr\$file") -Force
}
if (Test-Path -LiteralPath (Join-Path $source 'asr-build.json')) {
  Copy-Item -LiteralPath (Join-Path $source 'asr-build.json') -Destination $destination -Force
}
if ($SourceLicenses) {
  $licenseSource = (Resolve-Path -LiteralPath $SourceLicenses).Path
  New-Item -ItemType Directory -Force -Path (Join-Path $destination 'licenses') | Out-Null
  foreach ($name in @('cpython-3.11.9','onnxruntime-1.23.2','sensevoice','sherpa-onnx-1.12.28','sources.json')) {
    Copy-Item -LiteralPath (Join-Path $licenseSource $name) -Destination (Join-Path $destination 'licenses') -Recurse -Force
  }
}
$manifest = foreach ($file in Get-ChildItem -LiteralPath $destination -Recurse -File) {
  if ($file.Name -eq 'assets-manifest.json') { continue }
  [pscustomobject]@{ path=$file.FullName.Substring($destination.Length+1); bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash }
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $destination 'assets-manifest.json') -Encoding utf8
Write-Output ('ASR assets prepared locally: {0:N2} MiB' -f (($manifest | Measure-Object bytes -Sum).Sum / 1MB))
