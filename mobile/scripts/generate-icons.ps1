Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\Neeraj\Desktop\saas-native\mobile\assets\paramsukh.png"
$destDir = "c:\Users\Neeraj\Desktop\saas-native\mobile\assets\images"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir
}

# 1. Load and crop the source image into a transparent circle base logo
$srcImage = [System.Drawing.Image]::FromFile($srcPath)
$w = $srcImage.Width
$h = $srcImage.Height

# Create a transparent cropped base image of the same dimensions
$croppedBase = [System.Drawing.Bitmap]::new($w, $h)
$gBase = [System.Drawing.Graphics]::FromImage($croppedBase)

# Setup graphics quality
$gBase.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gBase.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gBase.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Create a circular clipping path
$centerX = $w / 2
$centerY = $h / 2
$radius = 233  # Fit the gold border
$x = $centerX - $radius
$y = $centerY - $radius
$diameter = $radius * 2

$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$path.AddEllipse($x, $y, $diameter, $diameter)
$gBase.SetClip($path)

# Draw the source logo onto the transparent base
$gBase.DrawImage($srcImage, 0, 0, $w, $h)

# Helper function to resize/pad from our cropped base
function Resize-Image {
    param (
        [System.Drawing.Image]$BaseImg,
        [string]$DestFile,
        [int]$CanvasWidth,
        [int]$CanvasHeight,
        [int]$TargetWidth,
        [int]$TargetHeight
    )
    $destBitmap = [System.Drawing.Bitmap]::new($CanvasWidth, $CanvasHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    
    # Enable high quality resizing
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Calculate centering coordinates
    $x = ($CanvasWidth - $TargetWidth) / 2
    $y = ($CanvasHeight - $TargetHeight) / 2
    
    $graphics.DrawImage($BaseImg, $x, $y, $TargetWidth, $TargetHeight)
    
    $destBitmap.Save($DestFile, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $destBitmap.Dispose()
}

Write-Output "Generating icon.png with circular crop..."
Resize-Image -BaseImg $croppedBase -DestFile "$destDir\icon.png" -CanvasWidth 1024 -CanvasHeight 1024 -TargetWidth 920 -TargetHeight 920

Write-Output "Generating android-icon-foreground.png with circular crop..."
Resize-Image -BaseImg $croppedBase -DestFile "$destDir\android-icon-foreground.png" -CanvasWidth 1024 -CanvasHeight 1024 -TargetWidth 676 -TargetHeight 676

Write-Output "Generating splash-icon.png with circular crop..."
Resize-Image -BaseImg $croppedBase -DestFile "$destDir\splash-icon.png" -CanvasWidth 1024 -CanvasHeight 1024 -TargetWidth 820 -TargetHeight 820

Write-Output "Generating favicon.png with circular crop..."
Resize-Image -BaseImg $croppedBase -DestFile "$destDir\favicon.png" -CanvasWidth 48 -CanvasHeight 48 -TargetWidth 48 -TargetHeight 48

# Dispose base images
$gBase.Dispose()
$croppedBase.Dispose()
$srcImage.Dispose()

Write-Output "All circular icons generated successfully!"
