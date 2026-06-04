import assert from 'node:assert/strict';
import test from 'node:test';

import {
  basenameFromManifestEntry,
  getRequiredAssetNames,
  parseArgs,
  parseSha256Manifest,
  verifyManifestHashes,
} from './verify-release-artifacts.mjs';

test('basenameFromManifestEntry handles path-prefixed and binary-mode entries', () => {
  assert.equal(
    basenameFromManifestEntry('src-tauri/target/release/bundle/macos/noder.app.zip'),
    'noder.app.zip'
  );
  assert.equal(basenameFromManifestEntry('*noder-portable.exe'), 'noder-portable.exe');
  assert.equal(basenameFromManifestEntry('windows\\noder-win.zip'), 'noder-win.zip');
});

test('parseSha256Manifest keeps valid SHA-256 entries and ignores malformed lines', () => {
  const windowsHash = 'a'.repeat(64);
  const macHash = 'b'.repeat(64);
  const entries = parseSha256Manifest(
    [
      '# comment',
      `${windowsHash}  noder-portable.exe`,
      'not-a-hash  ignored.exe',
      `${macHash} *src-tauri/target/release/bundle/macos/noder.app.zip`,
    ].join('\n')
  );

  assert.deepEqual(entries, [
    {
      expectedSha256: windowsHash,
      entryName: 'noder-portable.exe',
      fileName: 'noder-portable.exe',
    },
    {
      expectedSha256: macHash,
      entryName: 'src-tauri/target/release/bundle/macos/noder.app.zip',
      fileName: 'noder.app.zip',
    },
  ]);
});

test('getRequiredAssetNames accepts a versioned DMG and requires updater assets', () => {
  const assets = [
    'noder-portable.exe',
    'noder-win.zip',
    'SHA256SUMS-windows.txt',
    'noder.app.zip',
    'SHA256SUMS-macos.txt',
    'noder_0.1.4_aarch64.dmg',
  ];

  assert.deepEqual(getRequiredAssetNames(assets), assets);
});

test('getRequiredAssetNames reports missing required assets', () => {
  assert.throws(
    () => getRequiredAssetNames(['noder-portable.exe', 'SHA256SUMS-windows.txt']),
    /Missing required release assets: noder-win\.zip, noder\.app\.zip, SHA256SUMS-macos\.txt, macOS DMG/
  );
});

test('verifyManifestHashes compares manifest entries with local asset hashes', () => {
  const entries = [
    {
      expectedSha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      entryName: 'noder-portable.exe',
      fileName: 'noder-portable.exe',
    },
  ];
  const hashes = new Map([
    ['noder-portable.exe', '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
  ]);

  assert.deepEqual(verifyManifestHashes(entries, hashes), [
    {
      entryName: 'noder-portable.exe',
      fileName: 'noder-portable.exe',
      expectedSha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      actualSha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      match: true,
    },
  ]);
});

test('verifyManifestHashes fails when a referenced asset is unavailable', () => {
  assert.throws(
    () =>
      verifyManifestHashes(
        [
          {
            expectedSha256: 'c'.repeat(64),
            entryName: 'noder-win.zip',
            fileName: 'noder-win.zip',
          },
        ],
        new Map()
      ),
    /Manifest references noder-win\.zip, but that asset was not downloaded/
  );
});

test('parseArgs supports option pairs, equals syntax, and positional values', () => {
  assert.deepEqual(parseArgs(['--tag', 'v0.1.4', '--download-dir', 'C:\\tmp\\release']), {
    repo: 'oshtz/noder',
    tag: 'v0.1.4',
    downloadDir: 'C:\\tmp\\release',
    keepDownloads: true,
  });

  assert.deepEqual(parseArgs(['--repo=oshtz/noder', '--tag=v0.1.4']), {
    repo: 'oshtz/noder',
    tag: 'v0.1.4',
    downloadDir: null,
    keepDownloads: false,
  });

  assert.deepEqual(parseArgs(['v0.1.4', 'C:\\tmp\\release']), {
    repo: 'oshtz/noder',
    tag: 'v0.1.4',
    downloadDir: 'C:\\tmp\\release',
    keepDownloads: true,
  });
});
