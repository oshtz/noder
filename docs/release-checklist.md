# Release Checklist

Use this checklist before tagging or dispatching a release build.

## Local Gates

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run test:smoke
cd src-tauri && cargo check && cargo test
```

## Signing Secrets

macOS releases require:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Windows Authenticode signing is optional but recommended:

- `WINDOWS_CODESIGN_CERTIFICATE` as a base64-encoded `.pfx`
- `WINDOWS_CODESIGN_PASSWORD`

If the Windows secrets are missing, the workflow still publishes unsigned Windows artifacts and prints a warning in the build log.

## Release Assets

Every published release should include:

- `noder-win.zip`
- `noder-portable.exe`
- `SHA256SUMS-windows.txt`
- macOS `.dmg`
- `noder.app.zip`
- `SHA256SUMS-macos.txt`

Verify checksum manifests against the downloaded files before announcing a release.

## Updater Smoke Test

1. Install the previous released version on Windows and macOS.
2. Start the app outside dev mode.
3. Open Settings > Updates and check for updates.
4. Download the new update.
5. Restart/apply the update from the in-app prompt.
6. Confirm the app launches and reports the new version.
7. Confirm existing workflows, outputs, settings, and API keys still load.

## Installer Smoke Test

Windows:

1. Extract `noder-win.zip`.
2. Launch `noder.exe`.
3. Save a workflow, relaunch, and confirm it persists.
4. Launch `noder-portable.exe`.
5. If signing is enabled, verify the Authenticode signature from file properties or `Get-AuthenticodeSignature`.

macOS:

1. Mount the DMG.
2. Drag noder to Applications.
3. Launch the app and confirm Gatekeeper accepts it.
4. Save a workflow, relaunch, and confirm it persists.
5. Unzip `noder.app.zip` and confirm the direct app bundle launches.
