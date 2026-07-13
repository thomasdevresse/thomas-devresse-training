#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of ['index.html', 'about.html', 'privacy.html', 'robots.txt', 'sitemap.xml']) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, file));
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    const from = path.join(source, name);
    const to = path.join(destination, name);
    if (fs.statSync(from).isDirectory()) copyDirectory(from, to);
    else fs.copyFileSync(from, to);
  }
}

copyDirectory(path.join(root, 'assets'), path.join(out, 'assets'));
const imageOut = path.join(out, 'images');
fs.mkdirSync(imageOut, { recursive: true });
for (const file of [
  'logo-circle.png',
  'logo-circle-transp.png',
  'hero-thomas.png',
  'result-1.jpg',
  'result-2.jpg',
  'result-3.jpg',
  'thomas-portrait.png'
]) {
  fs.copyFileSync(path.join(root, 'images', file), path.join(imageOut, file));
}
for (const locale of ['fr', 'nl']) copyDirectory(path.join(root, locale), path.join(out, locale));

console.log('V2 static site built in public/');
