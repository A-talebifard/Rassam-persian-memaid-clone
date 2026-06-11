const fs = require('fs');
const path = require('path');

const nsisDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const releaseDir = path.join(__dirname, '..', 'release');

if (!fs.existsSync(nsisDir)) {
  console.error('NSIS bundle not found. Run "npm run tauri:build" first.');
  process.exit(1);
}

if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const files = fs.readdirSync(nsisDir).filter(f => f.endsWith('.exe'));

if (files.length === 0) {
  console.error('No .exe installer found in NSIS bundle.');
  process.exit(1);
}

for (const file of files) {
  const src = path.join(nsisDir, file);
  const dest = path.join(releaseDir, file);
  fs.copyFileSync(src, dest);
  const sizeMB = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
  console.log('Installer copied: release/' + file + ' (' + sizeMB + ' MB)');
}

console.log('Done! Check the "release" folder.');
