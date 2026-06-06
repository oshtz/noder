import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/build.yml', 'utf8');

const requiredSnippets = [
  'actions/checkout@v5',
  'actions/setup-node@v5',
  'actions/upload-artifact@v5',
  'softprops/action-gh-release@v3',
  "node-version: '22'",
  'WINDOWS_CODESIGN_CERTIFICATE',
  'WINDOWS_CODESIGN_PASSWORD',
  "github.event_name == 'workflow_dispatch' || startsWith(github.ref, 'refs/tags/v')",
  'Sign Windows app executable',
  'Sign Windows portable exe',
  'ENIGMA_VIRTUAL_BOX_INSTALLER_URL',
  'ENIGMA_VIRTUAL_BOX_INSTALLER_SHA256',
  'Get-FileHash -Algorithm SHA256 -Path $evbInstaller',
  'SHA256SUMS-windows.txt',
  'SHA256SUMS-macos.txt',
  'npm run test:release-artifacts',
  'npm run test:release-prereqs',
  'npm run test:release-version',
  'npm run check:release-version',
  'npm run check:release-prereqs',
  'require_windows_signing',
  'require_controlled_enigma_download',
  'noder-portable.exe',
  'noder-win.zip',
  'noder.app.zip',
  'src-tauri/target/release/bundle/dmg/*.dmg',
];

const missing = requiredSnippets.filter((snippet) => !workflow.includes(snippet));

if (missing.length > 0) {
  for (const snippet of missing) {
    console.error(
      `::error file=.github/workflows/build.yml::Missing release workflow smoke check snippet: ${snippet}`
    );
  }
  process.exit(1);
}

console.log('Release workflow smoke check passed.');
