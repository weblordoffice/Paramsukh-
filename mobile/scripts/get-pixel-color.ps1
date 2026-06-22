Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("c:\Users\Neeraj\Desktop\saas-native\mobile\assets\paramsukh.png")
$w = $img.Width
$h = $img.Height
$pixel = $img.GetPixel([int]($w/2), [int]($h/2))
Write-Output "Center Pixel Color:"
Write-Output $pixel
$pixelCorner = $img.GetPixel(10, 10)
Write-Output "Corner Pixel Color:"
Write-Output $pixelCorner
$img.Dispose()
