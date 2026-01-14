import * as lucide from 'lucide-react';
import fs from 'fs';

// Get all valid icon names
const validIcons = new Set(Object.keys(lucide).filter(name => {
  const item = lucide[name];
  if (!item || typeof item !== 'object' || !item.$$typeof) return false;
  if (name.startsWith('create') || name === 'icons' || name === 'default') return false;
  if (name.startsWith('Lucide') || name.endsWith('Icon')) return false;
  return true;
}));

console.log('Valid icons count:', validIcons.size);

// Files to fix
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

// Icon name mapping (wrong name -> correct name or delete)
const iconFixes = {
  'SpaceHorizontal': null, // Delete, doesn't exist
  'SpaceVertical': null,
  'LinkOff': 'Unlink', // Use Unlink instead
  'Cut': null, // Delete, use Scissors
  'TagX': null, // Delete, doesn't exist
  'Trademark': null, // Delete, doesn't exist
  'MessageSquareCheck': null, // Delete, doesn't exist
  'ViewOff': null, // Delete, use EyeOff
  'Pulse': null, // Delete, use HeartPulse
  'WrenchIcon': 'Wrench',
  'FingerprintOff': null, // Delete, doesn't exist
  'SdCard': null, // Delete, doesn't exist
  'UsbPort': 'Usb',
  'WebcamOff': null, // Delete, doesn't exist
  'SpeakerOff': null, // Delete, doesn't exist
  'PuzzlePiece': 'Puzzle',
  'Incognito': null, // Delete, doesn't exist
  'SkullIcon': 'Skull',
  'Sunglasses': 'Glasses',
  'HighlighterLine': 'Highlighter',
  'Ferriswheel': 'FerrisWheel', // Fix case
  'RatioIcon': 'Ratio',
  'Lemon': null, // Delete, doesn't exist
  'Hotdog': null, // Delete, doesn't exist
  'Bacon': null, // Delete, doesn't exist
  'Bread': null, // Delete, doesn't exist
  'Spoon': null, // Delete, doesn't exist
  'Knife': null, // Delete, doesn't exist
  'Fork': null, // Delete, doesn't exist
  'Protractor': null, // Delete, doesn't exist
  'Screwdriver': null, // Delete, doesn't exist
  'Sink': null, // Delete, doesn't exist
  'Mirror': null, // Delete, doesn't exist
  'Window': null, // Delete, doesn't exist
  'Curtains': null, // Delete, doesn't exist
  'Rug': null, // Delete, doesn't exist
  'Plant': 'Sprout', // Use Sprout instead
  'Vase': null, // Delete, doesn't exist
  'Candle': null, // Delete, doesn't exist
  // Category names (not icons)
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
        // Delete invalid icon (including preceding or following comma)
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
