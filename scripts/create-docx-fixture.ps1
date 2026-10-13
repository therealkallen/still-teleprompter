# A small, deterministic Word fixture for import validation. No Office installation needed.
Add-Type -AssemblyName System.IO.Compression
$fixtureDirectory = Join-Path $PSScriptRoot '../src/fixtures'
New-Item -ItemType Directory -Force -Path $fixtureDirectory | Out-Null
$fixturePath = Join-Path $fixtureDirectory 'sample.docx'
$fixtureFile = [System.IO.File]::Create($fixturePath)
$fixtureZip = [System.IO.Compression.ZipArchive]::new($fixtureFile, [System.IO.Compression.ZipArchiveMode]::Create)
$fixtureParts = @{
  '[Content_Types].xml' = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'
  '_rels/.rels' = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  'word/_rels/document.xml.rels' = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
  'word/styles.xml' = '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="PresenterCue"><w:name w:val="Presenter Cue"/></w:style></w:styles>'
  'word/document.xml' = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Opening</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">A </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>strong</w:t></w:r><w:r><w:t xml:space="preserve"> point.</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="PresenterCue"/></w:pPr><w:r><w:t>Pause and look up.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>'
}
try {
  foreach ($fixturePart in $fixtureParts.GetEnumerator()) {
    $fixtureEntry = $fixtureZip.CreateEntry($fixturePart.Key)
    $fixtureEntry.LastWriteTime = [DateTimeOffset]::new(2026, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
    $fixtureWriter = [System.IO.StreamWriter]::new($fixtureEntry.Open(), [System.Text.UTF8Encoding]::new($false))
    $fixtureWriter.Write($fixturePart.Value)
    $fixtureWriter.Dispose()
  }
} finally {
  $fixtureZip.Dispose()
  $fixtureFile.Dispose()
}
Write-Output "Created $fixturePath"
