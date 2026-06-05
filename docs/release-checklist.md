# Release Checklist

Use this checklist before pushing a `v*` tag or dispatching a release build.

## Local Gates

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run test:smoke
npm run test:release-artifacts
npm run test:release-prereqs
npm run test:release-version
npm run check:release-version
cd src-tauri && cargo check && cargo test
```

Before pushing a release tag, verify it matches every app version source:

```bash
npm run check:release-version -- v0.1.4
```

## Signing Secrets

macOS releases require:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Windows Authenticode signing is required by default for release packaging:

- `WINDOWS_CODESIGN_CERTIFICATE` as a base64-encoded `.pfx`
- `WINDOWS_CODESIGN_PASSWORD`

If the Windows secrets are missing, tagged release packaging fails before building Windows artifacts.
For a manual non-production packaging test, dispatch the workflow with
`allow_unsigned_windows=true`; the signing step will publish unsigned Windows artifacts and print a
warning in the build log.

Windows portable builds use Enigma Virtual Box. Configure these repository variables before release
packaging so the build uses an operator-controlled installer mirror and verifies it before install:

- `ENIGMA_VIRTUAL_BOX_INSTALLER_URL`
- `ENIGMA_VIRTUAL_BOX_INSTALLER_SHA256`

If those variables are missing, tagged release packaging fails before building Windows artifacts. For
a manual non-production packaging test, dispatch the workflow with
`allow_vendor_enigma_download=true` to permit the vendor fallback URLs.

## Release Assets

Release packaging runs for `v*` tags and manual workflow dispatches. Ordinary `main` pushes run validation only so they cannot republish an existing version by accident.

Every published release should include:

- `noder-win.zip`
- `noder-portable.exe`
- `SHA256SUMS-windows.txt`
- macOS `.dmg`
- `noder.app.zip`
- `SHA256SUMS-macos.txt`

Verify checksum manifests against the downloaded files before announcing a release.

The in-app updater requires the platform checksum manifest for available updates and verifies the downloaded update asset before it becomes installable.

After the release workflow publishes assets, verify the published files and checksum manifests:

```bash
npm run verify:release-artifacts -- v0.1.4
```

## Updater Smoke Test

1. Install the previous released version on Windows and macOS.
2. Start the app outside dev mode.
3. Open Settings > Updates and check for updates.
4. Download the new update.
5. Confirm missing or mismatched checksum manifests keep the update from reaching the ready-to-install state.
6. Restart/apply the update from the in-app prompt.
7. Confirm the app launches and reports the new version.
8. Confirm existing workflows, outputs, settings, and API keys still load.

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
