import * as lucide from 'lucide-react';
import fs from 'fs';

// 获取所有有效的图标名称
const validIcons = new Set(Object.keys(lucide).filter(name => {
  const item = lucide[name];
  if (!item || typeof item !== 'object' || !item.$$typeof) return false;
  if (name.startsWith('create') || name === 'icons' || name === 'default') return false;
  if (name.startsWith('Lucide') || name.endsWith('Icon')) return false;
  return true;
}));

console.log('Valid icons count:', validIcons.size);

// 需要修复的文件
const files = [
  'src/components/Notes/features/IconPicker/icons/common.ts',
  'src/components/Notes/features/IconPicker/icons/status.ts',
  'src/components/Notes/features/IconPicker/icons/dev.ts',
  'src/components/Notes/features/IconPicker/icons/user.ts',
  'src/components/Notes/features/IconPicker/icons/doc.ts',
  'src/components/Notes/features/IconPicker/icons/media.ts',
  'src/components/Notes/features/IconPicker/icons/nature.ts',
  'src/components/Notes/features/IconPicker/icons/place.ts'
];

// 图标名称映射（错误名称 -> 正确名称或删除）
const iconFixes = {
  'SpaceHorizontal': null, // 删除，不存在
  'SpaceVertical': null,
  'LinkOff': 'Unlink', // 使用 Unlink 代替
  'Cut': null, // 删除，使用 Scissors
  'TagX': null, // 删除，不存在
  'Trademark': null, // 删除，不存在
  'MessageSquareCheck': null, // 删除，不存在
  'ViewOff': null, // 删除，使用 EyeOff
  'Pulse': null, // 删除，使用 HeartPulse
  'WrenchIcon': 'Wrench',
  'FingerprintOff': null, // 删除，不存在
  'SdCard': null, // 删除，不存在
  'UsbPort': 'Usb',
  'WebcamOff': null, // 删除，不存在
  'SpeakerOff': null, // 删除，不存在
  'PuzzlePiece': 'Puzzle',
  'Incognito': null, // 删除，不存在
  'SkullIcon': 'Skull',
  'Sunglasses': 'Glasses',
  'HighlighterLine': 'Highlighter',
  'Ferriswheel': 'FerrisWheel', // 修正大小写
  'RatioIcon': 'Ratio',
  'Lemon': null, // 删除，不存在
  'Hotdog': null, // 删除，不存在
  'Bacon': null, // 删除，不存在
  'Bread': null, // 删除，不存在
  'Spoon': null, // 删除，不存在
  'Knife': null, // 删除，不存在
  'Fork': null, // 删除，不存在
  'Protractor': null, // 删除，不存在
  'Screwdriver': null, // 删除，不存在
  'Sink': null, // 删除，不存在
  'Mirror': null, // 删除，不存在
  'Window': null, // 删除，不存在
  'Curtains': null, // 删除，不存在
  'Rug': null, // 删除，不存在
  'Plant': 'Sprout', // 使用 Sprout 代替
  'Vase': null, // 删除，不存在
  'Candle': null, // 删除，不存在
  // 分类名称（不是图标）
  'Common': null,
  'Status': null,
  'Development': null,
  'Documents': null,
  'Media': null,
  'Nature': null,
  'Places': null,
};

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  Object.entries(iconFixes).forEach(([wrong, correct]) => {
    const regex = new RegExp(`'${wrong}'`, 'g');
    if (content.match(regex)) {
      if (correct) {
        content = content.replace(regex, `'${correct}'`);
        console.log(`${filePath}: Replaced '${wrong}' with '${correct}'`);
      } else {
        // 删除无效图标（包括前面的逗号或后面的逗号）
        content = content.replace(new RegExp(`,\\s*'${wrong}'`, 'g'), '');
        content = content.replace(new RegExp(`'${wrong}',\\s*`, 'g'), '');
        content = content.replace(new RegExp(`'${wrong}'`, 'g'), '');
        console.log(`${filePath}: Removed '${wrong}'`);
      }
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
  }
});

console.log('\nDone!');
