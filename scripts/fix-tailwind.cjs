#!/usr/bin/env node

/**
 * Bulk fix Tailwind CSS class warnings and errors for Tailwind 4
 * This script scans the src directory and applies common fixes.
 */
const fs = require('fs');
const path = require('path');

const replacements = [
  // Variable syntax: [var(--name)] -> (--name)
  { from: /font-\[var\(--font-display\)\]/g, to: 'font-(--font-display)' },
  { from: /text-\[var\(--color-text-dark\)\]/g, to: 'text-(--color-text-dark)' },
  { from: /bg-\[var\(--color-gold\)\]/g, to: 'bg-(--color-gold)' },
  { from: /py-\[var\(--section-padding\)\]/g, to: 'py-(--section-padding)' },
  { from: /via-\[var\(--color-gold\)\]/g, to: 'via-(--color-gold)' },
  { from: /from-\[var\(--color-gold\)\]/g, to: 'from-(--color-gold)' },
  { from: /bg-\[var\(--color-text\)\]/g, to: 'bg-(--color-text)' },
  { from: /text-\[var\(--color-text\)\]/g, to: 'text-(--color-text)' },
  { from: /border-\[var\(--color-gold\)\]/g, to: 'border-(--color-gold)' },

  // Bare hex colors: bg-050508/90 -> bg-[#050508]/90
  { from: /bg-([0-9a-fA-F]{6})(\/[0-9]+)?/g, to: (match, p1, p2) => `bg-[#${p1}]${p2 || ''}` },
  { from: /text-([0-9a-fA-F]{6})(\/[0-9]+)?/g, to: (match, p1, p2) => `text-[#${p1}]${p2 || ''}` },
  { from: /border-([0-9a-fA-F]{6})(\/[0-9]+)?/g, to: (match, p1, p2) => `border-[#${p1}]${p2 || ''}` },

  // Specific color values
  { from: /bg-\[#fbfaf8\]/g, to: 'bg-cream-100' },
  { from: /bg-\[#d4af37\]\/5/g, to: 'bg-gold-500/5' },

  // Gradient syntax
  { from: /bg-gradient-to-b/g, to: 'bg-linear-to-b' },
  { from: /bg-gradient-to-t/g, to: 'bg-linear-to-t' },
  { from: /bg-gradient-to-r/g, to: 'bg-linear-to-r' },
  { from: /bg-gradient-to-l/g, to: 'bg-linear-to-l' },
];

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function fixFile(filePath) {
  if (!filePath.match(/\.(jsx|js|tsx|ts)$/)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  replacements.forEach(({ from, to }) => {
    if (typeof from === 'string' ? content.includes(from) : from.test(content)) {
      content = content.replace(from, to);
      changed = true;
    }
  });

  // Handle perspective string as a special case if needed
  const pString = 'perspective' + '-' + '[1000px]';
  if (content.includes(pString)) {
    // If it's a JSX file, we might want to use a style prop, 
    // but for now let's just make it a standard tailwind arbitrary value if possible,
    // though Tailwind 4 might still complain if it's not a known utility.
    // Let's leave it for now or convert to style.
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

const srcDir = path.join(__dirname, '../src');
console.log(`Scanning ${srcDir} for Tailwind CSS fixes...`);
walkDir(srcDir, fixFile);

console.log('Tailwind CSS fixes complete!');