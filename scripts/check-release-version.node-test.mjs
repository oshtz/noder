import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseArgs,
  parseCargoPackageVersion,
  validateReleaseVersions,
} from './check-release-version.mjs';

const matchingFiles = {
  packageJson: JSON.stringify({ version: '0.1.4' }),
  packageLockJson: JSON.stringify({
    version: '0.1.4',
    packages: {
      '': {
        version: '0.1.4',
      },
    },
  }),
  cargoToml: '[package]\nname = "noder"\nversion = "0.1.4"\n',
  tauriConfJson: JSON.stringify({ version: '0.1.4' }),
};

test('parseCargoPackageVersion reads the package version', () => {
  assert.equal(
    parseCargoPackageVersion(
      [
        '[workspace]',
        'members = []',
        '',
        '[package]',
        'name = "noder"',
        'version = "0.1.4"',
        '',
        '[dependencies]',
        'serde = "1"',
      ].join('\n')
    ),
    '0.1.4'
  );
});

test('validateReleaseVersions passes when every version source matches', () => {
  assert.deepEqual(validateReleaseVersions(matchingFiles), {
    version: '0.1.4',
    errors: [],
  });
});

test('validateReleaseVersions fails when package-lock root versions drift', () => {
  const result = validateReleaseVersions({
    ...matchingFiles,
    packageLockJson: JSON.stringify({
      version: '0.1.5',
      packages: {
        '': {
          version: '0.1.4',
        },
      },
    }),
  });

  assert.match(result.errors.join('\n'), /package-lock\.json top-level version is 0\.1\.5/);
});

test('validateReleaseVersions fails when Cargo or Tauri versions drift', () => {
  const result = validateReleaseVersions({
    ...matchingFiles,
    cargoToml: '[package]\nname = "noder"\nversion = "0.1.5"\n',
    tauriConfJson: JSON.stringify({ version: '0.1.6' }),
  });

  assert.match(result.errors.join('\n'), /src-tauri\/Cargo\.toml package version is 0\.1\.5/);
  assert.match(result.errors.join('\n'), /src-tauri\/tauri\.conf\.json version is 0\.1\.6/);
});

test('validateReleaseVersions fails when the release tag does not match the app version', () => {
  const result = validateReleaseVersions(matchingFiles, { expectedTag: 'v0.1.5' });

  assert.match(result.errors.join('\n'), /release tag v0\.1\.5 does not match version 0\.1\.4/);
});

test('validateReleaseVersions rejects malformed versions', () => {
  const result = validateReleaseVersions({
    ...matchingFiles,
    packageJson: JSON.stringify({ version: 'next' }),
  });

  assert.match(
    result.errors.join('\n'),
    /package\.json version next is not a valid release version/
  );
});

test('parseArgs supports --tag pairs and equals syntax', () => {
  assert.deepEqual(parseArgs(['--tag', 'v0.1.4']), { tag: 'v0.1.4' });
  assert.deepEqual(parseArgs(['--tag=v0.1.5']), { tag: 'v0.1.5' });
  assert.deepEqual(parseArgs(['v0.1.6']), { tag: 'v0.1.6' });
  assert.deepEqual(parseArgs([]), { tag: null });
});
