import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const files = [
  'index.html',
  'site.webmanifest',
  'favicon.ico',
  'favicon.svg',
  'apple-touch-icon.png',
  'containers_data.json',
  't.url.html',
  'e.url.html',
  'window.location.href.html'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(distDir, file));
  }
}

const assetsDir = path.resolve('assets');
if (fs.existsSync(assetsDir)) {
  fs.cpSync(assetsDir, path.join(distDir, 'assets'), { recursive: true });
}

console.log('Build completed successfully.');
