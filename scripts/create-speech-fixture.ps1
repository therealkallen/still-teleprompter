$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = Split-Path $PSScriptRoot -Parent
$artifactDir = Join-Path $projectRoot 'artifacts\v2'
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $synth.SetOutputToWaveFile((Join-Path $artifactDir 'synthetic-english.wav'), $format)
  $synth.Speak('Today we introduce Finance AI and Copilot. Invoice Registration improves Internal Control. RAG can retrieve knowledge. Power Automate helps the finance team automate business processes.')
} finally { $synth.Dispose() }
Write-Output 'Created synthetic English fixture (local Windows TTS; not a real presentation recording).'
