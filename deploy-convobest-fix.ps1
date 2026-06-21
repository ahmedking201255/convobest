param(
  [string]$KeyPath = "$PSScriptRoot\convobest_codex_ed25519",
  [string]$HostName = "92.113.18.234",
  [int]$Port = 65002,
  [string]$User = "u206521676"
)

$ErrorActionPreference = "Stop"

$srcPackage = Join-Path $PSScriptRoot ".deploy-package\convobest-media-send-fix-src-20260619-130518.tgz"
$buildPackage = Join-Path $PSScriptRoot ".deploy-package\convobest-next-build-20260619-130518.tgz"

if (!(Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key was not found: $KeyPath"
}

if (!(Test-Path -LiteralPath $srcPackage)) {
  throw "Source package was not found: $srcPackage"
}

if (!(Test-Path -LiteralPath $buildPackage)) {
  throw "Build package was not found: $buildPackage"
}

$target = "$User@$HostName"
$sshBase = @("-p", "$Port", "-i", $KeyPath, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes")
$scpBase = @("-P", "$Port", "-i", $KeyPath, "-o", "IdentitiesOnly=yes")

Write-Host "Checking SSH connection..."
& ssh @sshBase $target "echo ssh-ok; hostname; date; echo process-count-before; ps -u `$USER --no-headers | wc -l"

Write-Host "Uploading packages..."
& scp @scpBase $srcPackage "${target}:/home/u206521676/convobest-media-send-fix-src.tgz"
& scp @scpBase $buildPackage "${target}:/home/u206521676/convobest-next-build.tgz"

Write-Host "Deploying portal build..."
$deployCommand = @'
set -e
cd /home/u206521676/convobest-portal
tar -xzf /home/u206521676/convobest-media-send-fix-src.tgz
rm -rf .next
tar -xzf /home/u206521676/convobest-next-build.tgz
mkdir -p tmp
touch tmp/restart.txt
echo deployed-ok
echo process-count-after-deploy
ps -u $USER --no-headers | wc -l
echo top-processes
ps -u $USER -o pid,ppid,stat,etime,pcpu,pmem,comm,args --sort=-pcpu | head -80
echo node-go-passenger-processes
pgrep -afu $USER 'node|next|npm|passenger|evolution|go|ssh|scp' || true
'@

& ssh @sshBase $target $deployCommand

Write-Host "Testing public site..."
try {
  $response = Invoke-WebRequest -Uri "https://convobest.com/dashboard/inbox" -UseBasicParsing -TimeoutSec 30
  Write-Host "dashboard/inbox status:" $response.StatusCode
} catch {
  Write-Warning $_.Exception.Message
}

Write-Host "Done."
