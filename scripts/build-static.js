#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public');

if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

['index.html', 'admin.html', 'robots.txt', 'sitemap.xml'].forEach((f) => {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, f));
});

const imagesDir = path.join(root, 'images');
const outImages = path.join(out, 'images');
if (fs.existsSync(imagesDir)) {
  if (!fs.existsSync(outImages)) fs.mkdirSync(outImages, { recursive: true });
  fs.readdirSync(imagesDir).forEach((name) => {
    const src = path.join(imagesDir, name);
    if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(outImages, name));
  });
}

// Self-hosted video assets are intentionally omitted — reel uses YouTube embed only (keeps deploy size small).

console.log('Static files copied to public/');
