import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO = 'oshtz/noder';
const REQUIRED_ASSETS = [
  'noder-portable.exe',
  'noder-win.zip',
  'SHA256SUMS-windows.txt',
  'noder.app.zip',
  'SHA256SUMS-macos.txt',
];
const MANIFEST_ASSETS = ['SHA256SUMS-windows.txt', 'SHA256SUMS-macos.txt'];
const SHA256_LINE = /^([a-f0-9]{64})\s+(.+)$/i;

export function basenameFromManifestEntry(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^\*/, '')
    .replace(/\\/g, '/');
  return normalized.substring(normalized.lastIndexOf('/') + 1);
}

export function parseSha256Manifest(content) {
  return String(content ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const match = SHA256_LINE.exec(line);
      if (!match) return null;
      const entryName = match[2].trim().replace(/^\*/, '');
      return {
        expectedSha256: match[1].toLowerCase(),
        entryName,
        fileName: basenameFromManifestEntry(entryName),
      };
    })
    .filter(Boolean);
}

export function getRequiredAssetNames(assetNames) {
  const available = new Set(assetNames);
  const missing = REQUIRED_ASSETS.filter((asset) => !available.has(asset));
  const dmg = assetNames.find((asset) => /^noder_.*\.dmg$/i.test(asset));

  if (!dmg) {
    missing.push('macOS DMG');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required release assets: ${missing.join(', ')}`);
  }

  return [...REQUIRED_ASSETS, dmg];
}

export function verifyManifestHashes(entries, assetHashes) {
  return entries.map((entry) => {
    const actualSha256 = assetHashes.get(entry.fileName);
    if (!actualSha256) {
      throw new Error(`Manifest references ${entry.fileName}, but that asset was not downloaded.`);
    }

    return {
      ...entry,
      actualSha256,
      match: actualSha256 === entry.expectedSha256,
    };
  });
}

export function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    tag: null,
    downloadDir: null,
    keepDownloads: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--repo=')) {
      args.repo = arg.slice('--repo='.length);
    } else if (arg.startsWith('--tag=')) {
      args.tag = arg.slice('--tag='.length);
    } else if (arg.startsWith('--download-dir=')) {
      args.downloadDir = arg.slice('--download-dir='.length);
      args.keepDownloads = true;
    } else if (arg === '--repo') {
      args.repo = argv[++index];
    } else if (arg === '--tag') {
      args.tag = argv[++index];
    } else if (arg === '--download-dir') {
      args.downloadDir = argv[++index];
      args.keepDownloads = true;
    } else if (arg === '--keep-downloads') {
      args.keepDownloads = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (!arg.startsWith('-') && !args.tag && /^v?\d+\.\d+\.\d+/.test(arg)) {
      args.tag = arg;
    } else if (!arg.startsWith('-') && !args.downloadDir) {
      args.downloadDir = arg;
      args.keepDownloads = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  return [
    'Usage: node scripts/verify-release-artifacts.mjs [v0.1.4] [download-dir]',
    '       node scripts/verify-release-artifacts.mjs [--tag v0.1.4] [--repo oshtz/noder] [--download-dir path]',
    '',
    'Downloads release assets, verifies checksum manifests, and checks the updater-required assets.',
  ].join('\n');
}

async function getPackageTag() {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
  return `v${packageJson.version}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'noder-release-verifier',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'noder-release-verifier',
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}: ${await response.text()}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destination, bytes);
  return bytes;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function createDownloadDir(requestedDir) {
  if (requestedDir) {
    const resolved = path.resolve(requestedDir);
    await fs.mkdir(resolved, { recursive: true });
    return resolved;
  }

  return fs.mkdtemp(path.join(os.tmpdir(), 'noder-release-verify-'));
}

async function verifyReleaseArtifacts(options) {
  const tag = options.tag ?? (await getPackageTag());
  const release = await fetchJson(
    `https://api.github.com/repos/${options.repo}/releases/tags/${encodeURIComponent(tag)}`
  );
  const assetNames = release.assets.map((asset) => asset.name);
  const requiredAssetNames = getRequiredAssetNames(assetNames);
  const downloadDir = await createDownloadDir(options.downloadDir);

  const assetsByName = new Map(release.assets.map((asset) => [asset.name, asset]));
  const downloaded = new Map();

  for (const assetName of requiredAssetNames) {
    const asset = assetsByName.get(assetName);
    const destination = path.join(downloadDir, assetName);
    const bytes = await downloadFile(asset.browser_download_url, destination);
    downloaded.set(assetName, {
      bytes,
      path: destination,
      sha256: sha256(bytes),
      size: bytes.length,
    });
  }

  const allManifestEntries = [];
  for (const manifestName of MANIFEST_ASSETS) {
    const manifest = downloaded.get(manifestName);
    const content = manifest.bytes.toString('utf8');
    const entries = parseSha256Manifest(content);
    if (entries.length === 0) {
      throw new Error(`${manifestName} did not contain any SHA-256 entries.`);
    }
    allManifestEntries.push(...entries);
  }

  const assetHashes = new Map(
    [...downloaded.entries()]
      .filter(([assetName]) => !MANIFEST_ASSETS.includes(assetName))
      .map(([assetName, info]) => [assetName, info.sha256])
  );
  const hashResults = verifyManifestHashes(allManifestEntries, assetHashes);
  const mismatches = hashResults.filter((result) => !result.match);
  if (mismatches.length > 0) {
    throw new Error(
      `Release checksum mismatch: ${mismatches
        .map(
          (result) =>
            `${result.fileName} expected ${result.expectedSha256} got ${result.actualSha256}`
        )
        .join('; ')}`
    );
  }

  return {
    tag,
    releaseUrl: release.html_url,
    downloadDir,
    requiredAssetNames,
    downloaded: [...downloaded.entries()].map(([assetName, info]) => ({
      assetName,
      bytes: info.size,
      sha256: info.sha256,
      path: info.path,
    })),
    hashResults,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const result = await verifyReleaseArtifacts(args);
  console.log(`Verified release ${result.tag}: ${result.releaseUrl}`);
  for (const asset of result.downloaded) {
    console.log(`${asset.sha256}  ${asset.assetName}`);
  }
  console.log(`Downloaded assets to ${result.downloadDir}`);

  if (!args.keepDownloads && !args.downloadDir) {
    await fs.rm(result.downloadDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
