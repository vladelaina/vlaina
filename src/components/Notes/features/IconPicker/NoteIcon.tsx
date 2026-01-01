/**
 * NoteIcon - Renders either an emoji or a custom icon
 * 
 * Supports both emoji strings and icon:name:color format
 */

import {
  IconFileText,
  IconFolder,
  IconStar,
  IconHeart,
  IconBookmark,
  IconBulb,
  IconRocket,
  IconCode,
  IconBug,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconInfoCircle,
  IconQuestionMark,
  IconLock,
  IconKey,
  IconSettings,
  IconUser,
  IconUsers,
  IconHome,
  IconCalendar,
  IconClock,
  IconMail,
  IconPhone,
  IconCamera,
  IconPhoto,
  IconMusic,
  IconVideo,
  IconWorld,
  IconMap,
  IconFlag,
  IconTrophy,
  IconGift,
  IconShoppingCart,
  IconCreditCard,
  IconWallet,
  IconChartBar,
  IconDatabase,
  IconCloud,
  IconDownload,
  IconUpload,
  IconLink,
  IconPaperclip,
  IconPencil,
  IconTrash,
  IconArchive,
  IconClipboard,
  IconNote,
  IconBook,
  IconSchool,
  IconBriefcase,
  IconTools,
  IconPalette,
  IconBrush,
  IconFlask,
  IconAtom,
  IconPlant,
  IconLeaf,
  IconSun,
  IconMoon,
  IconBolt,
  IconFlame,
  IconDroplet,
  IconSnowflake,
} from '@tabler/icons-react';

// 图标名称到组件的映射
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  file: IconFileText,
  folder: IconFolder,
  star: IconStar,
  heart: IconHeart,
  bookmark: IconBookmark,
  bulb: IconBulb,
  rocket: IconRocket,
  code: IconCode,
  bug: IconBug,
  check: IconCheck,
  x: IconX,
  alert: IconAlertCircle,
  info: IconInfoCircle,
  question: IconQuestionMark,
  lock: IconLock,
  key: IconKey,
  settings: IconSettings,
  user: IconUser,
  users: IconUsers,
  home: IconHome,
  calendar: IconCalendar,
  clock: IconClock,
  mail: IconMail,
  phone: IconPhone,
  camera: IconCamera,
  photo: IconPhoto,
  music: IconMusic,
  video: IconVideo,
  world: IconWorld,
  map: IconMap,
  flag: IconFlag,
  trophy: IconTrophy,
  gift: IconGift,
  cart: IconShoppingCart,
  card: IconCreditCard,
  wallet: IconWallet,
  chart: IconChartBar,
  database: IconDatabase,
  cloud: IconCloud,
  download: IconDownload,
  upload: IconUpload,
  link: IconLink,
  clip: IconPaperclip,
  pencil: IconPencil,
  trash: IconTrash,
  archive: IconArchive,
  clipboard: IconClipboard,
  note: IconNote,
  book: IconBook,
  school: IconSchool,
  briefcase: IconBriefcase,
  tools: IconTools,
  palette: IconPalette,
  brush: IconBrush,
  flask: IconFlask,
  atom: IconAtom,
  plant: IconPlant,
  leaf: IconLeaf,
  sun: IconSun,
  moon: IconMoon,
  bolt: IconBolt,
  flame: IconFlame,
  droplet: IconDroplet,
  snowflake: IconSnowflake,
};

interface NoteIconProps {
  icon: string;
  size?: number;
  className?: string;
}

export function NoteIcon({ icon, size = 16, className }: NoteIconProps) {
  // 检查是否是自定义图标格式: icon:name:color
  if (icon.startsWith('icon:')) {
    const parts = icon.split(':');
    const iconName = parts[1];
    const color = parts[2] || '#6b7280';
    
    const IconComponent = ICON_MAP[iconName];
    if (IconComponent) {
      return <IconComponent size={size} style={{ color }} />;
    }
    // 如果找不到图标，返回默认文件图标
    return <IconFileText size={size} style={{ color: '#6b7280' }} />;
  }
  
  // 否则是 emoji
  return (
    <span 
      className={className}
      style={{ 
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
      }}
    >
      {icon}
    </span>
  );
}
