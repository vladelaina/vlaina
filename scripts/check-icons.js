import * as lucide from 'lucide-react';
import fs from 'fs';

console.log('='.repeat(60));
console.log('COMPREHENSIVE ICON CHECK');
console.log('='.repeat(60));

// Get all icons exported from lucide-react
const allExports = Object.keys(lucide);
const allIcons = allExports.filter(name => {
  const item = lucide[name];
  if (!item || typeof item !== 'object' || !item.$$typeof) return false;
  if (name.startsWith('create') || name === 'icons' || name === 'default') return false;
  if (name.startsWith('Lucide') || name.endsWith('Icon')) return false;
  return true;
});

console.log('\n[1] LUCIDE-REACT LIBRARY INFO');
console.log('-'.repeat(40));
console.log(`Total exports: ${allExports.length}`);
console.log(`Unique icons (excluding aliases): ${allIcons.length}`);

// Read all icon files
const files = [
      { name: 'common.ts', path: 'src/components/common/UniversalIconPicker/icons/common.ts' },
      { name: 'status.ts', path: 'src/components/common/UniversalIconPicker/icons/status.ts' },
      { name: 'dev.ts', path: 'src/components/common/UniversalIconPicker/icons/dev.ts' },
      { name: 'user.ts', path: 'src/components/common/UniversalIconPicker/icons/user.ts' },
      { name: 'doc.ts', path: 'src/components/common/UniversalIconPicker/icons/doc.ts' },
      { name: 'media.ts', path: 'src/components/common/UniversalIconPicker/icons/media.ts' },
      { name: 'nature.ts', path: 'src/components/common/UniversalIconPicker/icons/nature.ts' },
      { name: 'place.ts', path: 'src/components/common/UniversalIconPicker/icons/place.ts' }];

console.log('\n[2] ICONS PER FILE');
console.log('-'.repeat(40));

const usedIcons = new Set();
const iconsByFile = {};
let totalIconsInFiles = 0;

files.forEach(({ name, path }) => {
  const content = fs.readFileSync(path, 'utf-8');
  
  // Only match icon names in the ICONS array
  const iconsArrayMatch = content.match(/const ICONS = \[([\s\S]*?)\];/);
  if (!iconsArrayMatch) {
    console.log(`Warning: Could not find ICONS array in ${name}`);
    return;
  }
  
  const iconsArrayContent = iconsArrayMatch[1];
  const regex = /'([A-Z][a-zA-Z0-9]*)'/g;
  let match;
  const fileIcons = [];
  while ((match = regex.exec(iconsArrayContent)) !== null) {
    fileIcons.push(match[1]);
    usedIcons.add(match[1]);
  }
  iconsByFile[name] = fileIcons;
  totalIconsInFiles += fileIcons.length;
  console.log(`${name.padEnd(15)} ${fileIcons.length} icons`);
});

console.log('-'.repeat(40));
console.log(`Total (with duplicates): ${totalIconsInFiles}`);
console.log(`Unique icons used: ${usedIcons.size}`);

// Check unused icons
console.log('\n[3] UNUSED ICONS CHECK');
console.log('-'.repeat(40));
const unusedIcons = allIcons.filter(icon => !usedIcons.has(icon));
console.log(`Unused icons: ${unusedIcons.length}`);

if (unusedIcons.length > 0) {
  console.log('\nList of unused icons:');
  unusedIcons.forEach(icon => console.log(`  - ${icon}`));
}

// Check invalid icon names (in files but not in lucide-react)
console.log('\n[4] INVALID ICONS CHECK');
console.log('-'.repeat(40));
const invalidIcons = [...usedIcons].filter(icon => !allIcons.includes(icon));
console.log(`Invalid icons (not in lucide-react): ${invalidIcons.length}`);

if (invalidIcons.length > 0) {
  console.log('\nList of invalid icons:');
  invalidIcons.forEach(icon => console.log(`  - ${icon}`));
}

// Check duplicate icons
console.log('\n[5] DUPLICATE ICONS CHECK');
console.log('-'.repeat(40));
const allIconsInFiles = [];
files.forEach(({ name }) => {
  iconsByFile[name].forEach(icon => {
    allIconsInFiles.push({ icon, file: name });
  });
});

const iconOccurrences = {};
allIconsInFiles.forEach(({ icon, file }) => {
  if (!iconOccurrences[icon]) {
    iconOccurrences[icon] = [];
  }
  iconOccurrences[icon].push(file);
});

const duplicates = Object.entries(iconOccurrences)
  .filter(([_, files]) => files.length > 1)
  .map(([icon, files]) => ({ icon, files, count: files.length }));

console.log(`Icons appearing in multiple files: ${duplicates.length}`);

if (duplicates.length > 0 && duplicates.length <= 20) {
  console.log('\nDuplicate icons:');
  duplicates.forEach(({ icon, files, count }) => {
    console.log(`  - ${icon} (${count}x): ${files.join(', ')}`);
  });
} else if (duplicates.length > 20) {
  console.log(`\nFirst 20 duplicate icons:`);
  duplicates.slice(0, 20).forEach(({ icon, files, count }) => {
    console.log(`  - ${icon} (${count}x): ${files.join(', ')}`);
  });
}

// Final summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Lucide-react icons: ${allIcons.length}`);
console.log(`Icons in files: ${usedIcons.size}`);
console.log(`Coverage: ${((usedIcons.size / allIcons.length) * 100).toFixed(2)}%`);
console.log(`Unused: ${unusedIcons.length}`);
console.log(`Invalid: ${invalidIcons.length}`);
console.log(`Duplicates: ${duplicates.length}`);

if (unusedIcons.length === 0 && invalidIcons.length === 0) {
  console.log('\n✅ ALL ICONS ARE PROPERLY DISTRIBUTED!');
} else {
  console.log('\n⚠️ ISSUES FOUND - SEE DETAILS ABOVE');
}
