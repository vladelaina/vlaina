/**
 * 生成完整的 Phosphor Icons 数据文件
 * 
 * 运行: node scripts/generate-icons.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 动态导入 @phosphor-icons/core
const { icons } = await import('@phosphor-icons/core');

// Phosphor Icons 的官方分类（小写）
const CATEGORIES = {
  'arrows': [],
  'brand': [],
  'commerce': [],
  'communication': [],
  'design': [],
  'development': [],
  'editor': [],
  'education': [],
  'finances': [],
  'games': [],
  'health': [],
  'map': [],
  'media': [],
  'nature': [],
  'objects': [],
  'office': [],
  'people': [],
  'security': [],
  'system': [],
  'time': [],
  'weather': [],
  'other': [],
};

// 分类显示名称映射
const CATEGORY_DISPLAY_NAMES = {
  'arrows': 'Arrows',
  'brand': 'Brand',
  'commerce': 'Commerce',
  'communication': 'Communication',
  'design': 'Design',
  'development': 'Development',
  'editor': 'Editor',
  'education': 'Education',
  'finances': 'Finance',
  'games': 'Games',
  'health': 'Health',
  'map': 'Map',
  'media': 'Media',
  'nature': 'Nature',
  'objects': 'Objects',
  'office': 'Office',
  'people': 'People',
  'security': 'Security',
  'system': 'System',
  'time': 'Time',
  'weather': 'Weather',
  'other': 'Other',
};

// 将 kebab-case 转换为 PascalCase
function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// 处理每个图标
for (const icon of icons) {
  const { name, pascal_name, categories } = icon;
  const pascalName = pascal_name || toPascalCase(name);
  
  // 使用第一个分类，如果没有则放入 other
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

// 按名称排序每个分类
for (const cat of Object.keys(CATEGORIES)) {
  CATEGORIES[cat].sort((a, b) => a.name.localeCompare(b.name));
}

// 生成 TypeScript 文件
let output = `/**
 * 完整的 Phosphor Icons 图标数据
 * 
 * 自动生成，请勿手动修改
 * 生成命令: node scripts/generate-icons.mjs
 * 
 * 总计: ${icons.length} 个图标
 */

import {
`;

// 收集所有图标名称用于导入
const allPascalNames = new Set();
for (const iconList of Object.values(CATEGORIES)) {
  for (const icon of iconList) {
    allPascalNames.add(icon.pascalName);
  }
}

// 按字母顺序排序导入
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

// 生成分类数据
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

// 扁平化列表用于快速查找
export const ALL_ICONS_FULL = ICON_CATEGORIES_FULL.flatMap(c => c.icons);

// 图标名称到组件的映射
export const ICON_MAP_FULL = new Map<string, PhosphorIcon>(
  ALL_ICONS_FULL.map(({ name, icon }) => [name, icon])
);

// 根据名称获取图标
export function getIconByNameFull(name: string): PhosphorIcon | undefined {
  return ICON_MAP_FULL.get(name);
}
`;

// 写入文件
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
