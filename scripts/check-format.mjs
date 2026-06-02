import fs from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';

const rootDir = process.cwd();

const prettierOptions = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  printWidth: 100,
  endOfLine: 'lf',
  jsxSingleQuote: false,
};

const files = new Set();
const srcExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const scriptExtensions = new Set(['.js', '.mjs', '.cjs']);
const rootExtensions = new Set(['.js', '.json']);
const yamlExtensions = new Set(['.yml', '.yaml']);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function annotationValue(value) {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

async function pathExists(filePath) {
  try {
    await fs.access(path.join(rootDir, filePath));
    return true;
  } catch {
    return false;
  }
}

async function walk(relativeDir, includeFile) {
  if (!(await pathExists(relativeDir))) {
    return;
  }

  const dir = path.join(rootDir, relativeDir);
  const entries = await fs.readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDir, entry.name);

      if (entry.isDirectory()) {
        await walk(relativePath, includeFile);
        return;
      }

      if (entry.isFile() && includeFile(relativePath)) {
        files.add(toPosixPath(relativePath));
      }
    })
  );
}

async function addRootFiles() {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (rootExtensions.has(extension) && entry.name !== 'package-lock.json') {
      files.add(entry.name);
    }
  }
}

async function addFile(relativePath) {
  if (await pathExists(relativePath)) {
    files.add(toPosixPath(relativePath));
  }
}

await addRootFiles();
await walk('src', (filePath) => srcExtensions.has(path.extname(filePath)));
await walk('scripts', (filePath) => scriptExtensions.has(path.extname(filePath)));
await walk('.github', (filePath) => yamlExtensions.has(path.extname(filePath)));
await addFile('src-tauri/tauri.conf.json');
await walk('src-tauri/capabilities', (filePath) => path.extname(filePath) === '.json');

const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));
const failures = [];

for (const relativePath of sortedFiles) {
  const filePath = path.join(rootDir, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const normalizedSource = source.replace(/\r\n?/g, '\n');

  try {
    const isFormatted = await prettier.check(normalizedSource, {
      ...prettierOptions,
      filepath: filePath,
    });

    if (!isFormatted) {
      failures.push(relativePath);
      console.log(`::error file=${annotationValue(relativePath)}::Prettier formatting differs`);
    }
  } catch (error) {
    failures.push(relativePath);
    const message = error instanceof Error ? error.message : String(error);
    console.log(`::error file=${annotationValue(relativePath)}::${annotationValue(message)}`);
  }
}

if (failures.length > 0) {
  console.error(`Prettier formatting differs in ${failures.length} file(s).`);
  process.exit(1);
}

console.log(`Prettier format check passed for ${sortedFiles.length} file(s).`);
