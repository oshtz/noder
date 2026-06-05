import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJsonVersion(content, source, errors) {
  try {
    const parsed = JSON.parse(String(content ?? ''));
    return parsed.version ?? null;
  } catch (error) {
    errors.push(`${source} is not valid JSON: ${error.message}`);
    return null;
  }
}

export function parseCargoPackageVersion(content) {
  let inPackageSection = false;

  for (const line of String(content ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^\[.+\]$/.test(trimmed)) {
      inPackageSection = trimmed === '[package]';
      continue;
    }

    if (!inPackageSection) continue;

    const match = /^version\s*=\s*"([^"]+)"/.exec(trimmed);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function normalizeExpectedTag(tag) {
  const normalized = String(tag ?? '').trim();
  return normalized || null;
}

function addVersionMismatch(errors, source, actual, expected) {
  errors.push(`${source} version is ${actual || 'missing'}, expected ${expected}.`);
}

export function validateReleaseVersions(files, options = {}) {
  const errors = [];
  const packageVersion = readJsonVersion(files.packageJson, 'package.json', errors);
  const packageLockVersion = readJsonVersion(files.packageLockJson, 'package-lock.json', errors);
  let packageLockRootVersion = null;
  try {
    packageLockRootVersion =
      JSON.parse(String(files.packageLockJson ?? '')).packages?.['']?.version ?? null;
  } catch {
    packageLockRootVersion = null;
  }
  const cargoVersion = parseCargoPackageVersion(files.cargoToml);
  const tauriVersion = readJsonVersion(files.tauriConfJson, 'src-tauri/tauri.conf.json', errors);

  if (!packageVersion) {
    errors.push('package.json version is missing.');
  } else if (!RELEASE_VERSION.test(packageVersion)) {
    errors.push(`package.json version ${packageVersion} is not a valid release version.`);
  }

  if (packageVersion) {
    const expectedVersion = packageVersion;
    if (packageLockVersion !== expectedVersion) {
      addVersionMismatch(
        errors,
        'package-lock.json top-level',
        packageLockVersion,
        expectedVersion
      );
    }
    if (packageLockRootVersion !== expectedVersion) {
      addVersionMismatch(
        errors,
        'package-lock.json root package',
        packageLockRootVersion,
        expectedVersion
      );
    }
    if (cargoVersion !== expectedVersion) {
      addVersionMismatch(errors, 'src-tauri/Cargo.toml package', cargoVersion, expectedVersion);
    }
    if (tauriVersion !== expectedVersion) {
      addVersionMismatch(errors, 'src-tauri/tauri.conf.json', tauriVersion, expectedVersion);
    }
  }

  const expectedTag = normalizeExpectedTag(options.expectedTag);
  if (packageVersion && expectedTag) {
    const expectedVersionTag = `v${packageVersion}`;
    if (expectedTag !== expectedVersionTag) {
      errors.push(`release tag ${expectedTag} does not match version ${packageVersion}.`);
    }
  }

  return {
    version: packageVersion,
    errors,
  };
}

export function parseArgs(argv) {
  const args = { tag: null };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--tag') {
      args.tag = argv[index + 1] ?? null;
      index += 1;
    } else if (value.startsWith('--tag=')) {
      args.tag = value.slice('--tag='.length);
    } else if (!args.tag && !value.startsWith('-')) {
      args.tag = value;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function tagFromEnv(env) {
  if (String(env.GITHUB_REF ?? '').startsWith('refs/tags/v')) {
    return env.GITHUB_REF_NAME || String(env.GITHUB_REF).replace('refs/tags/', '');
  }
  return null;
}

async function readVersionFiles() {
  const [packageJson, packageLockJson, cargoToml, tauriConfJson] = await Promise.all([
    fs.readFile('package.json', 'utf8'),
    fs.readFile('package-lock.json', 'utf8'),
    fs.readFile('src-tauri/Cargo.toml', 'utf8'),
    fs.readFile('src-tauri/tauri.conf.json', 'utf8'),
  ]);

  return {
    packageJson,
    packageLockJson,
    cargoToml,
    tauriConfJson,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = validateReleaseVersions(await readVersionFiles(), {
    expectedTag: args.tag || tagFromEnv(process.env),
  });

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`::error::${error}`);
    }
    process.exit(1);
  }

  console.log(`Release version check passed: ${result.version}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}
