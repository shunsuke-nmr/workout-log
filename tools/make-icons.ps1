# アイコンの PNG を作る（Windows 標準の System.Drawing だけを使い、追加のインストールは不要）。
# 図形は icons/icon.svg と同じ。プロジェクトのフォルダで次のように実行する:
#   powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
# 背景は角を丸めない正方形にする（iPhone やマスク対応の端末が自分で角を丸めるため）。

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
$bg = [System.Drawing.ColorTranslator]::FromHtml('#2d6a63')
$fg = [System.Drawing.Color]::White

# 512 を基準にした図形（x, y, 幅, 高さ）
$shapes = @(
  @(136, 242, 240, 28),
  @(156, 168, 36, 176),
  @(320, 168, 36, 176),
  @(120, 196, 32, 120),
  @(360, 196, 32, 120)
)

function New-RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

foreach ($size in 180, 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($bg)
  $s = $size / 512
  $brush = New-Object System.Drawing.SolidBrush $fg
  foreach ($r in $shapes) {
    $path = New-RoundedRect ($r[0] * $s) ($r[1] * $s) ($r[2] * $s) ($r[3] * $s) (10 * $s)
    $g.FillPath($brush, $path)
    $path.Dispose()
  }
  $file = Join-Path $outDir "icon-$size.png"
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Output "created: icons/icon-$size.png"
}
