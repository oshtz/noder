import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function isPresent(value) {
  return String(value ?? '').trim().length > 0;
}

export function parseBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function isReleasePackagingEvent({ eventName, ref }) {
  return eventName === 'workflow_dispatch' || String(ref ?? '').startsWith('refs/tags/v');
}

export function validateWindowsReleasePrerequisites(options) {
  const errors = [];
  const warnings = [];

  if (!isReleasePackagingEvent(options)) {
    return { errors, warnings };
  }

  const allowUnsignedWindows = parseBooleanFlag(options.allowUnsignedWindows);
  const allowVendorEnigmaDownload = parseBooleanFlag(options.allowVendorEnigmaDownload);
  const hasWindowsCertificate = isPresent(options.windowsCertificate);
  const hasWindowsCertificatePassword = isPresent(options.windowsCertificatePassword);
  const enigmaInstallerUrl = String(options.enigmaInstallerUrl ?? '').trim();
  const enigmaInstallerSha256 = String(options.enigmaInstallerSha256 ?? '')
    .trim()
    .toLowerCase();
  const hasEnigmaInstallerUrl = enigmaInstallerUrl.length > 0;
  const hasEnigmaInstallerSha256 = enigmaInstallerSha256.length > 0;

  if (!hasWindowsCertificate || !hasWindowsCertificatePassword) {
    if (allowUnsignedWindows) {
      warnings.push(
        'Publishing unsigned Windows artifacts because allow_unsigned_windows was explicitly enabled.'
      );
    } else {
      errors.push(
        'Missing Windows signing secrets. Configure WINDOWS_CODESIGN_CERTIFICATE and WINDOWS_CODESIGN_PASSWORD, or manually dispatch with allow_unsigned_windows=true for an unsigned test build.'
      );
    }
  }

  if (hasEnigmaInstallerSha256 && !SHA256_HEX.test(enigmaInstallerSha256)) {
    errors.push('ENIGMA_VIRTUAL_BOX_INSTALLER_SHA256 must be a 64-character hex SHA-256 value.');
  }

  if (hasEnigmaInstallerUrl && !hasEnigmaInstallerSha256) {
    errors.push(
      'A custom Enigma installer URL is set without ENIGMA_VIRTUAL_BOX_INSTALLER_SHA256. Add the SHA-256 hash before release packaging.'
    );
  }

  if (!hasEnigmaInstallerUrl && hasEnigmaInstallerSha256) {
    errors.push(
      'ENIGMA_VIRTUAL_BOX_INSTALLER_SHA256 is set without ENIGMA_VIRTUAL_BOX_INSTALLER_URL.'
    );
  }

  if (!hasEnigmaInstallerUrl && !hasEnigmaInstallerSha256) {
    if (allowVendorEnigmaDownload) {
      warnings.push(
        'Using vendor Enigma Virtual Box download fallback because allow_vendor_enigma_download was explicitly enabled.'
      );
    } else {
      errors.push(
        'Missing controlled Enigma Virtual Box installer variables. Configure ENIGMA_VIRTUAL_BOX_INSTALLER_URL and ENIGMA_VIRTUAL_BOX_INSTALLER_SHA256, or manually dispatch with allow_vendor_enigma_download=true for a fallback test build.'
      );
    }
  }

  return { errors, warnings };
}

function optionsFromEnv(env) {
  return {
    eventName: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    allowUnsignedWindows: env.ALLOW_UNSIGNED_WINDOWS,
    allowVendorEnigmaDownload: env.ALLOW_VENDOR_ENIGMA_DOWNLOAD,
    windowsCertificate: env.WINDOWS_CODESIGN_CERTIFICATE,
    windowsCertificatePassword: env.WINDOWS_CODESIGN_PASSWORD,
    enigmaInstallerUrl: env.ENIGMA_VIRTUAL_BOX_INSTALLER_URL,
    enigmaInstallerSha256: env.ENIGMA_VIRTUAL_BOX_INSTALLER_SHA256,
  };
}

function main() {
  const result = validateWindowsReleasePrerequisites(optionsFromEnv(process.env));

  for (const warning of result.warnings) {
    console.warn(`::warning::${warning}`);
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`::error::${error}`);
    }
    process.exit(1);
  }

  console.log('Windows release prerequisite check passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
