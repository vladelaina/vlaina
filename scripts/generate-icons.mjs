/**
 * Generate complete Phosphor Icons data file
 * 
 * Run: node scripts/generate-icons.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamically import @phosphor-icons/core
const { icons } = await import('@phosphor-icons/core');

// Phosphor Icons official categories (lowercase)
// Sorted by user usage frequency: commonly used first
const CATEGORIES = {
  // High frequency - daily life, work, entertainment
  'commerce': [],              // Shopping, food, daily items
  'health & wellness': [],     // Health, sports, mood
  'office': [],                // Office, work
  'media': [],                 // Media, music, video
  'games': [],                 // Games, entertainment
  'communications': [],        // Communications, social
  'maps & travel': [],         // Maps, travel
  'nature': [],                // Nature, animals
  'weather': [],               // Weather
  'people': [],                // People
  'finances': [],              // Finance
  'objects': [],               // Objects
  // Medium frequency - tech related
  'technology & development': [], // Development
  'design': [],                // Design
  'system': [],                // System
  'editor': [],                // Editor
  // Low frequency
  'brands': [],                // Brand logos
  'arrows': [],                // Arrows (last)
  'other': [],                 // Other
};

// Category display name mapping (friendlier names)
const CATEGORY_DISPLAY_NAMES = {
  'commerce': 'Shopping & Food',
  'health & wellness': 'Health & Sports',
  'office': 'Work & Office',
  'media': 'Media & Music',
  'games': 'Games & Fun',
  'communications': 'Social',
  'maps & travel': 'Travel',
  'nature': 'Nature',
  'weather': 'Weather',
  'people': 'People',
  'finances': 'Finance',
  'objects': 'Objects',
  'technology & development': 'Tech & Dev',
  'design': 'Design',
  'system': 'System',
  'editor': 'Editor',
  'brands': 'Brands',
  'arrows': 'Arrows',
  'other': 'Other',
};

// Convert kebab-case to PascalCase
function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Process each icon
for (const icon of icons) {
  const { name, pascal_name, categories } = icon;
  const pascalName = pascal_name || toPascalCase(name);
  
  // Use first category, if none then put in other
  let category = 'other';
  if (categories && categories.length > 0) {
    const cat = categories[0];
    if (cat in CATEGORIES) {
      category = cat;
    }
  }
  
  CATEGORIES[category].push({
    name: name,
    pascalName: pascalName,
  });
}

// Sort each category by name
for (const cat of Object.keys(CATEGORIES)) {
  CATEGORIES[cat].sort((a, b) => a.name.localeCompare(b.name));
}

// Generate TypeScript file
let output = `/**
 * Complete Phosphor Icons data
 * 
 * Auto-generated, do not modify manually
 * Generate command: node scripts/generate-icons.mjs
 * 
 * Total: ${icons.length} icons
 */

import {
`;

// Collect all icon names for import
const allPascalNames = new Set();
for (const iconList of Object.values(CATEGORIES)) {
  for (const icon of iconList) {
    allPascalNames.add(icon.pascalName);
  }
}

// Sort imports alphabetically
const sortedNames = Array.from(allPascalNames).sort();
output += `  ${sortedNames.join(',\n  ')},\n`;
output += `  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

export interface IconDefinition {
  name: string;
  icon: PhosphorIcon;
}

export interface IconCategory {
  name: string;
  icons: IconDefinition[];
}

export const ICON_CATEGORIES_FULL: IconCategory[] = [
`;

// Generate category data
for (const [catName, iconList] of Object.entries(CATEGORIES)) {
  if (iconList.length === 0) continue;
  
  const displayName = CATEGORY_DISPLAY_NAMES[catName] || catName;
  output += `  {
    name: '${displayName}',
    icons: [
`;
  
  for (const icon of iconList) {
    output += `      { name: '${icon.name}', icon: ${icon.pascalName} },\n`;
  }
  
  output += `    ],
  },
`;
}

output += `];

// Flattened list for quick lookup
export const ALL_ICONS_FULL = ICON_CATEGORIES_FULL.flatMap(c => c.icons);

// Icon name to component mapping
export const ICON_MAP_FULL = new Map<string, PhosphorIcon>(
  ALL_ICONS_FULL.map(({ name, icon }) => [name, icon])
);

// Get icon by name
export function getIconByNameFull(name: string): PhosphorIcon | undefined {
  return ICON_MAP_FULL.get(name);
}
`;

// Write file
const outputPath = path.join(__dirname, '../src/components/Progress/features/IconPicker/fullIcons.ts');
fs.writeFileSync(outputPath, output, 'utf-8');

console.log(`Generated ${outputPath}`);
console.log(`Total icons: ${icons.length}`);
console.log('Categories:');
for (const [cat, iconList] of Object.entries(CATEGORIES)) {
  if (iconList.length > 0) {
    console.log(`  ${cat}: ${iconList.length}`);
  }
}
