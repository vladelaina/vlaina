param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$installer = (Get-Item $InstallerPath).FullName
$installDir = Join-Path $env:RUNNER_TEMP 'vlaina-installer-smoke'
$appPath = Join-Path $installDir 'vlaina.exe'
$appProcess = $null

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeWindow {
  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

try {
  $install = Start-Process -FilePath $installer -ArgumentList @(
    '/S',
    '/currentuser',
    "/D=$installDir"
  ) -PassThru
  if (-not $install.WaitForExit(120000)) {
    Stop-Process -Id $install.Id -Force
    throw 'Installer did not finish within 120 seconds.'
  }
  if ($install.ExitCode -ne 0) {
    throw "Installer exited with code $($install.ExitCode)."
  }
  if (-not (Test-Path $appPath -PathType Leaf)) {
    throw "Installed application was not found at $appPath."
  }

  $appProcess = Start-Process -FilePath $appPath -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  $windowReady = $false

  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $appProcess.Refresh()
    if ($appProcess.HasExited) {
      throw "Installed application exited with code $($appProcess.ExitCode) before showing a window."
    }

    $windowHandle = $appProcess.MainWindowHandle
    if (
      $windowHandle -ne [IntPtr]::Zero -and
      [NativeWindow]::IsWindowVisible($windowHandle) -and
      $appProcess.Responding
    ) {
      $windowReady = $true
      break
    }
  }

  if (-not $windowReady) {
    throw 'Installed application did not show a responsive window within 30 seconds.'
  }
} finally {
  if ($null -ne $appProcess -and -not $appProcess.HasExited) {
    $stop = Start-Process -FilePath taskkill.exe -ArgumentList @(
      '/PID',
      $appProcess.Id,
      '/T',
      '/F'
    ) -Wait -PassThru
    if ($stop.ExitCode -ne 0) {
      Write-Warning "Unable to stop the smoke-test process tree (exit code $($stop.ExitCode))."
    }
  }

  $uninstaller = Get-ChildItem -Path $installDir -Filter 'Uninstall *.exe' -File -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($null -ne $uninstaller) {
    $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -PassThru
    if (-not $uninstall.WaitForExit(60000)) {
      Stop-Process -Id $uninstall.Id -Force
      Write-Warning 'Uninstaller did not finish within 60 seconds.'
    } elseif ($uninstall.ExitCode -ne 0) {
      Write-Warning "Uninstaller exited with code $($uninstall.ExitCode)."
    }
  }
}
