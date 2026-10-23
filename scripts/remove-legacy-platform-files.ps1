$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot ".git"))) {
  throw "لم أجد مجلد .git. انسخ الحزمة إلى مشروع Git الصحيح قبل تشغيل هذا السكربت."
}

$legacyFiles = @(
  "client/public/__manus__/debug-collector.js",
  "client/public/manus-routes.json",
  "client/src/components/ManusDialog.tsx",
  "client/src/components/Map.tsx",
  "client/src/platform.d.ts",
  "server/_core/dataApi.ts",
  "server/_core/heartbeat.ts",
  "server/_core/imageGeneration.ts",
  "server/_core/llm.ts",
  "server/_core/map.ts",
  "server/_core/notification.ts",
  "server/_core/oauth.ts",
  "server/_core/publicConfig.ts",
  "server/_core/sdk.ts",
  "server/_core/storageProxy.ts",
  "server/_core/voiceTranscription.ts",
  "server/oauth.callback.test.ts",
  "server/platform.test.ts",
  "server/storage.ts",
  "server/_core/emailAuth.ts",
  "server/_core/emailDelivery.ts",
  "server/emailDelivery.test.ts"
)

foreach ($relativePath in $legacyFiles) {
  $fullPath = Join-Path $projectRoot $relativePath
  if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
    Remove-Item -LiteralPath $fullPath -Force
    Write-Host "Removed obsolete module: $relativePath"
  }
}
Write-Host "Finished removing listed legacy modules. No environment files, certificates, database tables, or user records were changed."
