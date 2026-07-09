#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public');

if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

['index.html', 'pricing.html', 'about.html', 'admin.html', 'robots.txt', 'sitemap.xml'].forEach((f) => {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, f));
});

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  fs.readdirSync(srcDir).forEach((name) => {
    const src = path.join(srcDir, name);
    const dst = path.join(dstDir, name);
    if (fs.statSync(src).isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  });
}
copyDir(path.join(root, 'images'), path.join(out, 'images'));

// Self-hosted video assets are intentionally omitted — reel uses YouTube embed only (keeps deploy size small).

console.log('Static files copied to public/');
