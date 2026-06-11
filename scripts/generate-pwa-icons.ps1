# Genera los íconos PWA (512/192/180) a partir de public/icon2.png,
# centrados al 80% (zona segura maskable) sobre fondo verde de marca (#062618).
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force (Join-Path $root 'public\icons') | Out-Null
$src = [System.Drawing.Image]::FromFile((Join-Path $root 'public\icon.png'))
foreach ($size in 512, 192, 180) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#062618'))
  $target = [int]($size * 0.8)
  $scale = [Math]::Min($target / $src.Width, $target / $src.Height)
  $w = [int]($src.Width * $scale)
  $h = [int]($src.Height * $scale)
  $x = [int](($size - $w) / 2)
  $y = [int](($size - $h) / 2)
  $g.DrawImage($src, $x, $y, $w, $h)
  $g.Dispose()
  $bmp.Save((Join-Path $root "public\icons\icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "icon-$size.png OK"
}
$src.Dispose()
