param(
  [string]$LogoSource,
  [string]$IconSource
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$brandDir = Join-Path $root 'docs\branding'
$publicDir = Join-Path $root 'public'
$green = [System.Drawing.ColorTranslator]::FromHtml('#062618')
$gold = [System.Drawing.ColorTranslator]::FromHtml('#e8b73a')
$ivory = [System.Drawing.ColorTranslator]::FromHtml('#e6e9e5')

function New-BrandGraphics($bitmap) {
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = 'AntiAlias'
  $graphics.InterpolationMode = 'HighQualityBicubic'
  $graphics.PixelOffsetMode = 'HighQuality'
  $graphics.CompositingQuality = 'HighQuality'
  return $graphics
}

function Save-BrandImage($image, [string]$path, [int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = New-BrandGraphics $bitmap
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($image, 0, 0, $size, $size)
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

# Recorte de exportación: descarta el perímetro irregular de la generación
# y coloca el arte dentro de un círculo con un aro geométrico consistente.
function Import-BrandMaster([string]$source, [string]$destination, [single]$cx, [single]$cy, [single]$radius) {
  $image = [System.Drawing.Image]::FromFile($source)
  $bitmap = [System.Drawing.Bitmap]::new(2048, 2048)
  $graphics = New-BrandGraphics $bitmap
  $goldBrush = [System.Drawing.SolidBrush]::new($gold)
  $greenBrush = [System.Drawing.SolidBrush]::new($green)
  $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.ScaleTransform(2, 2)
    $graphics.FillEllipse($goldBrush, 16, 16, 992, 992)
    $graphics.FillEllipse($greenBrush, 28, 28, 968, 968)
    $clip.AddEllipse(28, 28, 968, 968)
    $graphics.SetClip($clip)
    $sourceRect = [System.Drawing.RectangleF]::new($cx - $radius, $cy - $radius, 2 * $radius, 2 * $radius)
    $targetRect = [System.Drawing.RectangleF]::new(28, 28, 968, 968)
    $graphics.DrawImage($image, $targetRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.ResetClip()
    Save-BrandImage $bitmap $destination 1024
  } finally {
    $clip.Dispose()
    $goldBrush.Dispose()
    $greenBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    $image.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $brandDir | Out-Null
$logoMaster = Join-Path $brandDir 'logo-master.png'
$iconMaster = Join-Path $brandDir 't3-master.png'
if ([bool]$LogoSource -ne [bool]$IconSource) {
  throw 'Para importar nuevos maestros se deben indicar LogoSource e IconSource juntos.'
}
if ($LogoSource) {
  Import-BrandMaster $LogoSource $logoMaster 618 625 568
  Import-BrandMaster $IconSource $iconMaster 619 637 505
}

$logo = [System.Drawing.Image]::FromFile($logoMaster)
$icon = [System.Drawing.Image]::FromFile($iconMaster)
try {
  Save-BrandImage $logo (Join-Path $publicDir 'logo.png') 1024
  Save-BrandImage $logo (Join-Path $publicDir 'icon2.png') 512
  Save-BrandImage $icon (Join-Path $publicDir 'icon.png') 256

  # Tarjeta horizontal para Open Graph / Twitter. Texto y composición
  # deterministas: las exportaciones no requieren volver a generar con IA.
  $social = [System.Drawing.Bitmap]::new(1200, 630)
  $graphics = New-BrandGraphics $social
  $titleFont = [System.Drawing.Font]::new('Georgia', 64, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subtitleFont = [System.Drawing.Font]::new('Georgia', 34, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $urlFont = [System.Drawing.Font]::new('Segoe UI', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $ivoryBrush = [System.Drawing.SolidBrush]::new($ivory)
  $goldBrush = [System.Drawing.SolidBrush]::new($gold)
  $rule = [System.Drawing.Pen]::new($gold, 2)
  try {
    $graphics.Clear($green)
    $graphics.TextRenderingHint = 'AntiAliasGridFit'
    $graphics.DrawImage($logo, 40, 65, 500, 500)
    $graphics.DrawString('Truco a 3', $titleFont, $ivoryBrush, 600, 176)
    $graphics.DrawString("La variante de`npunto exacto", $subtitleFont, $ivoryBrush, 604, 276)
    $graphics.DrawLine($rule, 608, 386, 1100, 386)
    $graphics.DrawString('truco.ezevillo.com', $urlFont, $goldBrush, 604, 416)
    $social.Save((Join-Path $publicDir 'logo2.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $rule.Dispose()
    $ivoryBrush.Dispose()
    $goldBrush.Dispose()
    $titleFont.Dispose()
    $subtitleFont.Dispose()
    $urlFont.Dispose()
    $graphics.Dispose()
    $social.Dispose()
  }
} finally {
  $logo.Dispose()
  $icon.Dispose()
}

& (Join-Path $PSScriptRoot 'generate-pwa-icons.ps1')
Write-Output 'Marca exportada: logo, emblema, T3, tarjeta social e iconos PWA.'
