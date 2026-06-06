import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isReleasePackagingEvent,
  parseBooleanFlag,
  validateWindowsReleasePrerequisites,
} from './check-release-prerequisites.mjs';

const completePrerequisites = {
  eventName: 'push',
  ref: 'refs/tags/v0.1.5',
  windowsCertificate: 'base64-pfx',
  windowsCertificatePassword: 'secret',
  enigmaInstallerUrl: 'https://example.com/enigmavb.exe',
  enigmaInstallerSha256: 'a'.repeat(64),
};

test('isReleasePackagingEvent matches tag and manual release builds only', () => {
  assert.equal(isReleasePackagingEvent({ eventName: 'push', ref: 'refs/tags/v0.1.5' }), true);
  assert.equal(
    isReleasePackagingEvent({ eventName: 'workflow_dispatch', ref: 'refs/heads/main' }),
    true
  );
  assert.equal(isReleasePackagingEvent({ eventName: 'push', ref: 'refs/heads/main' }), false);
  assert.equal(
    isReleasePackagingEvent({ eventName: 'pull_request', ref: 'refs/pull/1/merge' }),
    false
  );
});

test('parseBooleanFlag accepts GitHub Actions-style booleans', () => {
  assert.equal(parseBooleanFlag(true), true);
  assert.equal(parseBooleanFlag('true'), true);
  assert.equal(parseBooleanFlag('TRUE'), true);
  assert.equal(parseBooleanFlag(false), false);
  assert.equal(parseBooleanFlag('false'), false);
  assert.equal(parseBooleanFlag(''), false);
  assert.equal(parseBooleanFlag(undefined), false);
});

test('validateWindowsReleasePrerequisites passes with signing and controlled Enigma configured', () => {
  assert.deepEqual(validateWindowsReleasePrerequisites(completePrerequisites), {
    errors: [],
    warnings: [],
  });
});

test('validateWindowsReleasePrerequisites warns when Windows signing secrets are missing', () => {
  const result = validateWindowsReleasePrerequisites({
    ...completePrerequisites,
    windowsCertificate: '',
  });

  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join('\n'), /Publishing unsigned Windows artifacts/);
});

test('validateWindowsReleasePrerequisites rejects missing signing when strict signing is required', () => {
  const result = validateWindowsReleasePrerequisites({
    ...completePrerequisites,
    windowsCertificate: '',
    requireWindowsSigning: 'true',
  });

  assert.match(result.errors.join('\n'), /Missing Windows signing secrets/);
  assert.deepEqual(result.warnings, []);
});

test('validateWindowsReleasePrerequisites warns when controlled Enigma mirror is missing', () => {
  const result = validateWindowsReleasePrerequisites({
    ...completePrerequisites,
    enigmaInstallerUrl: '',
    enigmaInstallerSha256: '',
  });

  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join('\n'), /Using vendor Enigma Virtual Box download fallback/);
});

test('validateWindowsReleasePrerequisites rejects vendor Enigma fallback when strict mirror is required', () => {
  const result = validateWindowsReleasePrerequisites({
    ...completePrerequisites,
    enigmaInstallerUrl: '',
    enigmaInstallerSha256: '',
    requireControlledEnigmaDownload: 'true',
  });

  assert.match(
    result.errors.join('\n'),
    /Missing controlled Enigma Virtual Box installer variables/
  );
  assert.deepEqual(result.warnings, []);
});

test('validateWindowsReleasePrerequisites rejects custom Enigma URL without a valid SHA-256', () => {
  const missingHash = validateWindowsReleasePrerequisites({
    ...completePrerequisites,
    enigmaInstallerSha256: '',
    allowVendorEnigmaDownload: 'true',
  });
  const invalidHash = validateWindowsReleasePrerequisites({
    ...completePrerequisites,
    enigmaInstallerSha256: 'not-a-sha',
  });

  assert.match(missingHash.errors.join('\n'), /custom Enigma installer URL is set without/);
  assert.match(invalidHash.errors.join('\n'), /must be a 64-character hex SHA-256/);
});
