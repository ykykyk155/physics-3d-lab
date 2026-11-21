# 本地启动器：在本目录起一个只监听 127.0.0.1 的静态服务器，并自动打开浏览器。
# 纯 ASCII 脚本（PS 5.1 按 GBK 读 .ps1，中文注释会吞行）。
# 用 TcpListener 手写 HTTP，不需要管理员权限、不需要 urlacl、不依赖 python/node。

param(
    [string]$Root = $PSScriptRoot,
    [int]$Port = 8931,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
if (-not (Test-Path (Join-Path $Root 'index.html'))) {
    Write-Host "[ERR] index.html not found next to this script: $Root" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

function Get-Mime([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        '.html' { 'text/html; charset=utf-8' }
        '.js'   { 'text/javascript; charset=utf-8' }
        '.mjs'  { 'text/javascript; charset=utf-8' }
        '.json' { 'application/json; charset=utf-8' }
        '.css'  { 'text/css; charset=utf-8' }
        '.png'  { 'image/png' }
        '.jpg'  { 'image/jpeg' }
        '.svg'  { 'image/svg+xml' }
        '.ico'  { 'image/x-icon' }
        '.woff2'{ 'font/woff2' }
        default { 'application/octet-stream' }
    }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
} catch {
    Write-Host "[ERR] port $Port is busy. Close the other window and retry." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$url = "http://127.0.0.1:$Port/index.html"
Write-Host ""
Write-Host "  3D Physics Lab - local server running" -ForegroundColor Green
Write-Host "  $url"
Write-Host ""
Write-Host "  Keep this window open while using the page."
Write-Host "  Close this window (or press Ctrl+C) to stop." -ForegroundColor DarkGray
Write-Host ""
if ($NoBrowser) {
    Write-Host "  (browser not opened: -NoBrowser)"
} else {
    Start-Process $url
}

while ($true) {
    $client = $null
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $stream.ReadTimeout = 5000

        # read request head (until blank line)
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
        $requestLine = $reader.ReadLine()
        if ($null -eq $requestLine) { $client.Close(); continue }
        while ($true) {
            $line = $reader.ReadLine()
            if ([string]::IsNullOrEmpty($line)) { break }
        }

        $parts = $requestLine -split ' '
        $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
        $rawPath = $rawPath.Split('?')[0]
        $rawPath = [System.Uri]::UnescapeDataString($rawPath).TrimStart('/')
        if ([string]::IsNullOrEmpty($rawPath)) { $rawPath = 'index.html' }

        $file = Join-Path $Root $rawPath
        $status = '200 OK'
        $body = $null
        $mime = 'text/plain; charset=utf-8'

        # keep requests inside Root
        $full = [System.IO.Path]::GetFullPath($file)
        if (-not $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $status = '403 Forbidden'
            $body = [System.Text.Encoding]::UTF8.GetBytes('403')
        } elseif (Test-Path -LiteralPath $full -PathType Leaf) {
            $body = [System.IO.File]::ReadAllBytes($full)
            $mime = Get-Mime $full
        } else {
            $status = '404 Not Found'
            $body = [System.Text.Encoding]::UTF8.GetBytes('404')
        }

        $header = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
        $head = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($head, 0, $head.Length)
        $stream.Write($body, 0, $body.Length)
        $stream.Flush()
    } catch {
        # a broken request must never kill the server
    } finally {
        if ($client) { try { $client.Close() } catch {} }
    }
}