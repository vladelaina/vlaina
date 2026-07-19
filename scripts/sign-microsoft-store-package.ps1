[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackagePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-WindowsSdkTool([string]$Name) {
    $sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
    $candidate = Get-ChildItem $sdkRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d+\.\d+' } |
        Sort-Object { [version]$_.Name } -Descending |
        ForEach-Object { Join-Path $_.FullName "x64\$Name" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    if ($candidate) { return $candidate }
    throw "$Name was not found. Install the Windows 10/11 SDK."
}

$PackagePath = (Resolve-Path $PackagePath).Path
$publisher = 'CN=5503A135-7FA4-466B-815C-DBE627F4065F'
$certificate = $null
$certificatePath = Join-Path $env:TEMP "vlaina-store-$([guid]::NewGuid()).pfx"

try {
    $certificate = New-SelfSignedCertificate `
        -Type Custom `
        -KeyUsage DigitalSignature `
        -KeyExportPolicy Exportable `
        -CertStoreLocation 'Cert:\CurrentUser\My' `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') `
        -Subject $publisher `
        -FriendlyName 'vlaina temporary Microsoft Store package signing'
    $password = [guid]::NewGuid().ToString('N')
    Export-PfxCertificate -Cert $certificate -FilePath $certificatePath `
        -Password (ConvertTo-SecureString $password -AsPlainText -Force) | Out-Null

    & (Get-WindowsSdkTool 'signtool.exe') sign /fd SHA256 /f $certificatePath /p $password $PackagePath
    if ($LASTEXITCODE -ne 0) { throw "SignTool failed with exit code $LASTEXITCODE." }
}
finally {
    if ($certificate) {
        Remove-Item "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $certificatePath -Force -ErrorAction SilentlyContinue
}
