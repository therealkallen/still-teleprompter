import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const texts = new Map();
const components = [];
function licenseFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = fs.readdirSync(directory).map(name => path.join(directory, name)).filter(file => fs.statSync(file).isFile());
  const licenses = files.filter(file => /^(licen[sc]e|copying|copyright|notice|thirdparty)/i.test(path.basename(file)));
  // isarray 1.0.0 ships its full MIT text in README.md rather than a LICENSE file.
  return licenses.length ? licenses : files.filter(file => /^readme/i.test(path.basename(file))
    && /^#{1,2} License\s*$/im.test(fs.readFileSync(file, 'utf8'))
    && fs.readFileSync(file, 'utf8').includes('Permission is hereby granted'));
}

function addComponent(kind, name, version, license, source, files) {
  if (!files.length) throw new Error(`Missing license text: ${kind} ${name}@${version}`);
  const refs = [...new Set(files.map(file => {
    let text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
    if (/^readme/i.test(path.basename(file))) text = text.slice(text.search(/^#{1,2} License\s*$/im));
    if (!text) throw new Error(`Empty license: ${name}`);
    const hash = createHash('sha256').update(text).digest('hex');
    texts.set(hash, text);
    return hash;
  }))];
  components.push({ kind, name, version, license, source, refs });
}

function resolveNpm(name, from) {
  let directory = from;
  while (true) {
    const manifest = path.join(directory, 'node_modules', name, 'package.json');
    if (fs.existsSync(manifest)) return manifest;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Cannot find installed dependency: ${name}`);
    directory = parent;
  }
}
const visited = new Set();
function npmDependencies(manifest) {
  const pkg = readJson(manifest);
  for (const name of Object.keys(pkg.dependencies ?? {}).sort()) {
    const child = resolveNpm(name, path.dirname(manifest));
    if (visited.has(child)) continue;
    visited.add(child);
    const dependency = readJson(child);
    const repository = typeof dependency.repository === 'string' ? dependency.repository : dependency.repository?.url;
    addComponent('npm', dependency.name, dependency.version, dependency.license ?? 'see text', repository ?? `https://www.npmjs.com/package/${dependency.name}/v/${dependency.version}`, licenseFiles(path.dirname(child)));
    npmDependencies(child);
  }
}
npmDependencies(path.join(root, 'package.json'));

const cargo = spawnSync('cargo', ['metadata', '--offline', '--locked', '--manifest-path', path.join(root, 'src-tauri', 'Cargo.toml'), '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc'], { encoding: 'utf8', cwd: root, maxBuffer: 16 * 1024 * 1024 });
if (cargo.status !== 0) throw new Error(`Cargo metadata failed: ${cargo.error?.message ?? cargo.stderr}`);
const metadata = JSON.parse(cargo.stdout);
for (const pkg of metadata.packages) {
  if (pkg.id === metadata.resolve.root) continue;
  const directory = path.dirname(pkg.manifest_path);
  const files = licenseFiles(directory);
  if (pkg.license_file) {
    const declared = path.resolve(directory, pkg.license_file);
    if (fs.existsSync(declared) && !files.includes(declared)) files.push(declared);
  }
  files.push(...licenseFiles(path.join(root, 'docs', 'licenses', 'rust', `${pkg.name}-${pkg.version}`)));
  addComponent('cargo', pkg.name, pkg.version, pkg.license ?? 'see text', pkg.repository ?? `https://crates.io/crates/${pkg.name}/${pkg.version}`, files);
}

components.sort((a, b) => `${a.kind}/${a.name}/${a.version}`.localeCompare(`${b.kind}/${b.name}/${b.version}`, 'en'));
const lines = ["Still application dependency licenses", "Generated from the installed production npm graph and locked Windows Cargo graph.", "Includes Cargo build dependencies. Model/runtime licenses are in docs/licenses/runtime/.", "Each component references the full texts below by SHA-256.", ""];
for (const component of components) {
  lines.push(`${component.kind}: ${component.name}@${component.version}`, `License: ${component.license}`, `Source: ${component.source}`, `Texts: ${component.refs.join(', ')}`, '');
}
for (const [hash, text] of [...texts].sort(([a], [b]) => a.localeCompare(b))) lines.push(`================ ${hash} ================`, text, '');
const output = path.join(root, 'docs', 'THIRD-PARTY-LICENSES.txt');
fs.writeFileSync(output, lines.join('\n'), 'utf8');
console.log(`Collected ${components.length} components and ${texts.size} distinct license texts (${fs.statSync(output).size} bytes).`);
