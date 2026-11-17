# Build a self-contained static release folder.
# NOTE: this file is intentionally pure ASCII. Windows PowerShell 5.1 reads
# .ps1 as ANSI (GBK here); UTF-8 Chinese comments can swallow the next line and
# break parsing. Chinese text lives in tools/release-readme.md instead.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-release.ps1
# Output: release/physics-3d-lab/  (upload the whole folder as-is)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$app  = Join-Path $repo 'docs\app'
$out  = Join-Path $repo 'release\physics-3d-lab'
$relRoot = Split-Path -Parent $out

if (-not (Test-Path $app)) { throw "app dir not found: $app" }

# clean rebuild
if (Test-Path $relRoot) { Remove-Item $relRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $out | Out-Null

# runtime whitelist only
Copy-Item (Join-Path $app 'index.html') $out

$entry = Join-Path $app 'experiments.js'
if (-not (Test-Path $entry)) {
    throw "experiments.js missing (index.html imports it) - release would be blank"
}
Copy-Item $entry $out

Copy-Item (Join-Path $app 'exp')    (Join-Path $out 'exp')    -Recurse
Copy-Item (Join-Path $app 'vendor') (Join-Path $out 'vendor') -Recurse

# data source: self-contained copy inside the package
$dataDir = Join-Path $out 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$selfJson = Join-Path $app 'data\experiments.json'
if (-not (Test-Path $selfJson)) { throw "app/data/experiments.json missing" }
Copy-Item $selfJson (Join-Path $dataDir 'experiments.json')

# strip dev artifacts that may have slipped into the whitelisted dirs
Get-ChildItem $out -Recurse -File | Where-Object { $_.Extension -in '.mjs','.md','.bat','.ps1','.py' } | Remove-Item -Force
Get-ChildItem $out -Recurse -Directory | Where-Object { $_.Name -in 'shots','all','diag' } | Remove-Item -Recurse -Force

# deployment readme (UTF-8 source, bytes copied as-is; added after the strip step)
$readmeSrc = Join-Path $PSScriptRoot 'release-readme.md'
if (Test-Path $readmeSrc) { Copy-Item $readmeSrc (Join-Path $out 'README.md') }

# --- verify: every required file must exist, one by one ---
$required = @(
    'index.html',
    'experiments.js',
    'exp\common.js', 'exp\props.js', 'exp\mechanics.js', 'exp\optics.js',
    'exp\acoustics.js', 'exp\electricity.js', 'exp\thermal.js',
    'vendor\three.module.js', 'vendor\three.core.js',
    'vendor\addons\controls\OrbitControls.js',
    'vendor\addons\renderers\CSS2DRenderer.js',
    'vendor\addons\lines\Line2.js', 'vendor\addons\lines\LineGeometry.js',
    'vendor\addons\lines\LineMaterial.js', 'vendor\addons\lines\LineSegments2.js',
    'vendor\addons\utils\BufferGeometryUtils.js',
    'data\experiments.json'
)
$missing = @()
foreach ($r in $required) {
    if (-not (Test-Path (Join-Path $out $r))) { $missing += $r }
}

# --- verify: index.html must be self-contained ---
$idx = [System.IO.File]::ReadAllText((Join-Path $out 'index.html'), [System.Text.Encoding]::UTF8)
$fetchOk = $idx -match "fetch\('\./data/experiments\.json'\)"
$importOk = $idx -match "import\('\./experiments\.js'\)"
$badRef = $idx -match "fetch\('\.\./"

# --- verify: data source parses ---
$scenes = 0
$kindCount = 0
$jsonOk = $false
try {
    $j = Get-Content (Join-Path $out 'data\experiments.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $scenes = @($j.experiments).Count
    $kindCount = @($j.experiments | Where-Object { $_.durationZeroKind }).Count
    $jsonOk = $true
} catch {
    Write-Host ("[ERR ] experiments.json parse failed: " + $_.Exception.Message) -ForegroundColor Red
}

# --- summary ---
$files = Get-ChildItem $out -Recurse -File
$size = [math]::Round((($files | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
Write-Host ""
Write-Host "OUT    $out"
Write-Host ("FILES  {0}   SIZE  {1} MB" -f $files.Count, $size)
Write-Host "TOP"
Get-ChildItem $out | Sort-Object PSIsContainer -Descending | ForEach-Object {
    if ($_.PSIsContainer) { Write-Host ("  {0,-14} <dir>" -f $_.Name) }
    else { Write-Host ("  {0,-14} {1} KB" -f $_.Name, [math]::Round($_.Length / 1KB, 1)) }
}
Write-Host ""
Write-Host "CHECKS"
if ($missing.Count -eq 0) { Write-Host ("  [OK  ] required files {0}/{0}" -f $required.Count) -ForegroundColor Green }
else { Write-Host ("  [FAIL] missing: " + ($missing -join ', ')) -ForegroundColor Red }

if ($badRef) { Write-Host "  [FAIL] index.html still fetches '../...' - package would 404" -ForegroundColor Red }
elseif ($fetchOk) { Write-Host "  [OK  ] data via ./data/experiments.json (self-contained)" -ForegroundColor Green }
else { Write-Host "  [WARN] fetch path not recognised, check index.html by hand" -ForegroundColor Yellow }

if ($importOk) { Write-Host "  [OK  ] registry via ./experiments.js" -ForegroundColor Green }
else { Write-Host "  [FAIL] import('./experiments.js') not found" -ForegroundColor Red }

if ($jsonOk) {
    Write-Host ("  [OK  ] experiments.json parsed: {0} scenes, {1} with durationZeroKind" -f $scenes, $kindCount) -ForegroundColor Green
    if ($scenes -ne 25) { Write-Host "  [WARN] scene count is not 25" -ForegroundColor Yellow }
} else {
    Write-Host "  [FAIL] experiments.json unreadable" -ForegroundColor Red
}

$pass = ($missing.Count -eq 0) -and $fetchOk -and (-not $badRef) -and $importOk -and $jsonOk -and ($scenes -eq 25)
Write-Host ""
if ($pass) { Write-Host "RELEASE READY" -ForegroundColor Green; exit 0 }
else { Write-Host "RELEASE BLOCKED" -ForegroundColor Red; exit 1 }