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
  'Sign Windows app executable',
  'Sign Windows portable exe',
  'SHA256SUMS-windows.txt',
  'SHA256SUMS-macos.txt',
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
