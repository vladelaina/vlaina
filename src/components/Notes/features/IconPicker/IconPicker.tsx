/**
 * IconPicker - Emoji and Icon picker for document icons
 * 
 * Custom implementation with full emoji support and hover preview
 */

import { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import data from '@emoji-mart/data';
import { cn } from '@/lib/utils';
import { IconSearch } from '@tabler/icons-react';
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
  IconTarget,
  IconBell,
  IconMessage,
  IconSend,
  IconInbox,
  IconAt,
  IconHash,
  IconTag,
  IconPin,
  IconMapPin,
  IconCompass,
  IconPlane,
  IconCar,
  IconMountain,
  IconTree,
  IconFlower,
  IconApple,
  IconCoffee,
  IconPizza,
  IconCake,
  IconCookie,
  IconBeer,
  IconFish,
  IconIceCream,
  IconBurger,
  IconMoodSmile,
  IconMoodHappy,
  IconMoodWink,
  IconThumbUp,
  IconEye,
  IconBrain,
  IconDna,
  IconPill,
  IconMicroscope,
  IconCalculator,
  IconTriangle,
  IconSquare,
  IconCircle,
  IconHexagon,
  IconDiamond,
  IconCrown,
  IconAward,
  IconMedal,
  IconSparkles,
  IconWand,
  IconBattery,
  IconCpu,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDeviceGamepad,
  IconHeadphones,
  IconMicrophone,
  IconVolume,
  IconPlayerPlay,
  IconWifi,
  IconPrinter,
  IconShield,
  IconFriends,
  IconBuilding,
  IconTent,
  IconCampfire,
  IconTrain,
  IconBalloon,
  IconConfetti,
  IconGhost,
  IconSkull,
  IconCat,
  IconDog,
  IconDeer,
  IconHorse,
  IconPig,
  IconFeather,
  IconButterfly,
} from '@tabler/icons-react';

type TabType = 'emoji' | 'icons';

// localStorage keys
const RECENT_ICONS_KEY = 'nekotick-recent-icons';
const SKIN_TONE_KEY = 'nekotick-emoji-skin-tone';
const MAX_RECENT_EMOJIS = 18; // 两行，每行9个

// 皮肤色调 - 使用挥手 emoji
const SKIN_TONES = [
  { tone: 0, emoji: '\u{1F44B}', label: '默认' },
  { tone: 1, emoji: '\u{1F44B}\u{1F3FB}', label: '浅色' },
  { tone: 2, emoji: '\u{1F44B}\u{1F3FC}', label: '中浅色' },
  { tone: 3, emoji: '\u{1F44B}\u{1F3FD}', label: '中色' },
  { tone: 4, emoji: '\u{1F44B}\u{1F3FE}', label: '中深色' },
  { tone: 5, emoji: '\u{1F44B}\u{1F3FF}', label: '深色' },
];

function loadRecentIcons(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_ICONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRecentIcons(icons: string[]): void {
  try {
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(icons));
  } catch { /* ignore */ }
}

function addToRecentIcons(icon: string, current: string[]): string[] {
  const filtered = current.filter(i => i !== icon);
  if (icon.startsWith('icon:')) {
    const icons = filtered.filter(i => i.startsWith('icon:'));
    const emojis = filtered.filter(i => !i.startsWith('icon:'));
    return [icon, ...icons.slice(0, MAX_RECENT_EMOJIS - 1), ...emojis];
  } else {
    const icons = filtered.filter(i => i.startsWith('icon:'));
    const emojis = filtered.filter(i => !i.startsWith('icon:'));
    const updated = [icon, ...emojis.slice(0, MAX_RECENT_EMOJIS - 1), ...icons];
    saveRecentIcons(updated);
    return updated;
  }
}

function loadSkinTone(): number {
  try {
    const saved = localStorage.getItem(SKIN_TONE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

function saveSkinTone(tone: number): void {
  try {
    localStorage.setItem(SKIN_TONE_KEY, tone.toString());
  } catch { /* ignore */ }
}

interface EmojiItem {
  id: string;
  native: string;
  name: string;
  keywords: string[];
  skins?: { native: string }[];
}

interface EmojiCategory {
  id: string;
  name: string;
  emojis: EmojiItem[];
}

const CATEGORY_NAMES: Record<string, string> = {
  frequent: '最近使用',
  people: '表情与人物',
  nature: '动物与自然',
  foods: '食物与饮料',
  activity: '活动',
  places: '旅行与地点',
  objects: '物品',
  symbols: '符号',
  flags: '旗帜',
};

// 分类图标映射
const CATEGORY_ICONS: Record<string, string> = {
  people: '\u{1F497}',
  nature: '\u{1F984}',
  foods: '\u{1F980}',
  activity: '\u{1F380}',
  places: '\u{1F308}',
  objects: '\u{1F9FC}',
  symbols: '\u{269C}\u{FE0F}',
  flags: '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}',
};


function buildEmojiCategories(): EmojiCategory[] {
  const emojiData = data as any;
  const categories: EmojiCategory[] = [];
  
  for (const cat of emojiData.categories) {
    if (cat.id === 'frequent') continue;
    
    const emojis: EmojiItem[] = [];
    for (const emojiId of cat.emojis) {
      const emoji = emojiData.emojis[emojiId];
      if (emoji && emoji.skins && emoji.skins[0]) {
        emojis.push({
          id: emojiId,
          native: emoji.skins[0].native,
          name: emoji.name || emojiId,
          keywords: emoji.keywords || [],
          skins: emoji.skins,
        });
      }
    }
    
    categories.push({
      id: cat.id,
      name: CATEGORY_NAMES[cat.id] || cat.id,
      emojis,
    });
  }
  
  return categories;
}

const EMOJI_CATEGORIES = buildEmojiCategories();

const ICON_LIST = [
  // 常用
  { name: 'file', icon: IconFileText, color: '#6366f1' },
  { name: 'folder', icon: IconFolder, color: '#f59e0b' },
  { name: 'star', icon: IconStar, color: '#eab308' },
  { name: 'heart', icon: IconHeart, color: '#ef4444' },
  { name: 'bookmark', icon: IconBookmark, color: '#8b5cf6' },
  { name: 'target', icon: IconTarget, color: '#ef4444' },
  { name: 'bulb', icon: IconBulb, color: '#f59e0b' },
  { name: 'rocket', icon: IconRocket, color: '#3b82f6' },
  { name: 'sparkles', icon: IconSparkles, color: '#f59e0b' },
  { name: 'crown', icon: IconCrown, color: '#f59e0b' },
  { name: 'award', icon: IconAward, color: '#f59e0b' },
  { name: 'trophy', icon: IconTrophy, color: '#f59e0b' },
  { name: 'medal', icon: IconMedal, color: '#f59e0b' },
  { name: 'gift', icon: IconGift, color: '#ec4899' },
  // 状态
  { name: 'check', icon: IconCheck, color: '#22c55e' },
  { name: 'x', icon: IconX, color: '#ef4444' },
  { name: 'alert', icon: IconAlertCircle, color: '#f59e0b' },
  { name: 'info', icon: IconInfoCircle, color: '#3b82f6' },
  { name: 'question', icon: IconQuestionMark, color: '#8b5cf6' },
  { name: 'bell', icon: IconBell, color: '#f59e0b' },
  { name: 'pin', icon: IconPin, color: '#ef4444' },
  { name: 'flag', icon: IconFlag, color: '#ef4444' },
  // 开发
  { name: 'code', icon: IconCode, color: '#10b981' },
  { name: 'bug', icon: IconBug, color: '#ef4444' },
  { name: 'database', icon: IconDatabase, color: '#6b7280' },
  { name: 'cpu', icon: IconCpu, color: '#6b7280' },
  { name: 'cloud', icon: IconCloud, color: '#3b82f6' },
  { name: 'wifi', icon: IconWifi, color: '#3b82f6' },
  { name: 'shield', icon: IconShield, color: '#22c55e' },
  { name: 'lock', icon: IconLock, color: '#6b7280' },
  { name: 'key', icon: IconKey, color: '#f59e0b' },
  { name: 'settings', icon: IconSettings, color: '#6b7280' },
  // 用户
  { name: 'user', icon: IconUser, color: '#3b82f6' },
  { name: 'users', icon: IconUsers, color: '#3b82f6' },
  { name: 'friends', icon: IconFriends, color: '#3b82f6' },
  { name: 'smile', icon: IconMoodSmile, color: '#f59e0b' },
  { name: 'happy', icon: IconMoodHappy, color: '#22c55e' },
  { name: 'wink', icon: IconMoodWink, color: '#ec4899' },
  { name: 'thumbup', icon: IconThumbUp, color: '#3b82f6' },
  { name: 'eye', icon: IconEye, color: '#6b7280' },
  // 通讯
  { name: 'mail', icon: IconMail, color: '#3b82f6' },
  { name: 'message', icon: IconMessage, color: '#3b82f6' },
  { name: 'send', icon: IconSend, color: '#3b82f6' },
  { name: 'inbox', icon: IconInbox, color: '#6b7280' },
  { name: 'phone', icon: IconPhone, color: '#22c55e' },
  { name: 'at', icon: IconAt, color: '#3b82f6' },
  { name: 'hash', icon: IconHash, color: '#6b7280' },
  { name: 'tag', icon: IconTag, color: '#8b5cf6' },
  { name: 'link', icon: IconLink, color: '#6366f1' },
  // 时间
  { name: 'calendar', icon: IconCalendar, color: '#ef4444' },
  { name: 'clock', icon: IconClock, color: '#6b7280' },
  { name: 'sun', icon: IconSun, color: '#f59e0b' },
  { name: 'moon', icon: IconMoon, color: '#6366f1' },
  // 地点
  { name: 'home', icon: IconHome, color: '#6366f1' },
  { name: 'building', icon: IconBuilding, color: '#6b7280' },
  { name: 'world', icon: IconWorld, color: '#3b82f6' },
  { name: 'map', icon: IconMap, color: '#22c55e' },
  { name: 'mappin', icon: IconMapPin, color: '#ef4444' },
  { name: 'compass', icon: IconCompass, color: '#3b82f6' },
  { name: 'plane', icon: IconPlane, color: '#3b82f6' },
  { name: 'car', icon: IconCar, color: '#6b7280' },
  { name: 'train', icon: IconTrain, color: '#6b7280' },
  { name: 'mountain', icon: IconMountain, color: '#22c55e' },
  { name: 'tent', icon: IconTent, color: '#f59e0b' },
  { name: 'campfire', icon: IconCampfire, color: '#ef4444' },
  // 媒体
  { name: 'camera', icon: IconCamera, color: '#6b7280' },
  { name: 'photo', icon: IconPhoto, color: '#8b5cf6' },
  { name: 'music', icon: IconMusic, color: '#ec4899' },
  { name: 'video', icon: IconVideo, color: '#ef4444' },
  { name: 'headphones', icon: IconHeadphones, color: '#6b7280' },
  { name: 'microphone', icon: IconMicrophone, color: '#ef4444' },
  { name: 'play', icon: IconPlayerPlay, color: '#22c55e' },
  { name: 'volume', icon: IconVolume, color: '#3b82f6' },
  // 文档
  { name: 'note', icon: IconNote, color: '#f59e0b' },
  { name: 'book', icon: IconBook, color: '#8b5cf6' },
  { name: 'clipboard', icon: IconClipboard, color: '#6366f1' },
  { name: 'pencil', icon: IconPencil, color: '#f59e0b' },
  { name: 'archive', icon: IconArchive, color: '#6b7280' },
  { name: 'trash', icon: IconTrash, color: '#ef4444' },
  { name: 'download', icon: IconDownload, color: '#22c55e' },
  { name: 'upload', icon: IconUpload, color: '#3b82f6' },
  { name: 'printer', icon: IconPrinter, color: '#6b7280' },
  // 工作
  { name: 'briefcase', icon: IconBriefcase, color: '#6b7280' },
  { name: 'school', icon: IconSchool, color: '#3b82f6' },
  { name: 'chart', icon: IconChartBar, color: '#3b82f6' },
  { name: 'wallet', icon: IconWallet, color: '#f59e0b' },
  { name: 'cart', icon: IconShoppingCart, color: '#6366f1' },
  { name: 'card', icon: IconCreditCard, color: '#6b7280' },
  { name: 'calculator', icon: IconCalculator, color: '#6b7280' },
  // 创意
  { name: 'palette', icon: IconPalette, color: '#ec4899' },
  { name: 'brush', icon: IconBrush, color: '#8b5cf6' },
  { name: 'wand', icon: IconWand, color: '#8b5cf6' },
  { name: 'tools', icon: IconTools, color: '#6b7280' },
  // 科学
  { name: 'flask', icon: IconFlask, color: '#22c55e' },
  { name: 'atom', icon: IconAtom, color: '#3b82f6' },
  { name: 'microscope', icon: IconMicroscope, color: '#6b7280' },
  { name: 'dna', icon: IconDna, color: '#8b5cf6' },
  { name: 'brain', icon: IconBrain, color: '#ec4899' },
  { name: 'pill', icon: IconPill, color: '#ef4444' },
  // 自然
  { name: 'plant', icon: IconPlant, color: '#22c55e' },
  { name: 'leaf', icon: IconLeaf, color: '#22c55e' },
  { name: 'tree', icon: IconTree, color: '#22c55e' },
  { name: 'flower', icon: IconFlower, color: '#ec4899' },
  { name: 'droplet', icon: IconDroplet, color: '#3b82f6' },
  { name: 'snowflake', icon: IconSnowflake, color: '#06b6d4' },
  { name: 'bolt', icon: IconBolt, color: '#f59e0b' },
  { name: 'flame', icon: IconFlame, color: '#ef4444' },
  // 食物
  { name: 'coffee', icon: IconCoffee, color: '#92400e' },
  { name: 'pizza', icon: IconPizza, color: '#f59e0b' },
  { name: 'cake', icon: IconCake, color: '#ec4899' },
  { name: 'apple', icon: IconApple, color: '#ef4444' },
  { name: 'cookie', icon: IconCookie, color: '#f59e0b' },
  { name: 'icecream', icon: IconIceCream, color: '#ec4899' },
  { name: 'beer', icon: IconBeer, color: '#f59e0b' },
  { name: 'burger', icon: IconBurger, color: '#f59e0b' },
  { name: 'fish', icon: IconFish, color: '#06b6d4' },
  // 动物
  { name: 'cat', icon: IconCat, color: '#f59e0b' },
  { name: 'dog', icon: IconDog, color: '#92400e' },
  { name: 'deer', icon: IconDeer, color: '#92400e' },
  { name: 'horse', icon: IconHorse, color: '#92400e' },
  { name: 'pig', icon: IconPig, color: '#ec4899' },
  { name: 'feather', icon: IconFeather, color: '#3b82f6' },
  { name: 'butterfly', icon: IconButterfly, color: '#ec4899' },
  // 节日
  { name: 'balloon', icon: IconBalloon, color: '#ef4444' },
  { name: 'confetti', icon: IconConfetti, color: '#f59e0b' },
  { name: 'ghost', icon: IconGhost, color: '#6b7280' },
  { name: 'skull', icon: IconSkull, color: '#1f2937' },
  // 设备
  { name: 'desktop', icon: IconDeviceDesktop, color: '#6b7280' },
  { name: 'laptop', icon: IconDeviceLaptop, color: '#6b7280' },
  { name: 'mobile', icon: IconDeviceMobile, color: '#6b7280' },
  { name: 'tablet', icon: IconDeviceTablet, color: '#6b7280' },
  { name: 'gamepad', icon: IconDeviceGamepad, color: '#8b5cf6' },
  { name: 'battery', icon: IconBattery, color: '#22c55e' },
  // 形状
  { name: 'circle', icon: IconCircle, color: '#3b82f6' },
  { name: 'square', icon: IconSquare, color: '#22c55e' },
  { name: 'triangle', icon: IconTriangle, color: '#f59e0b' },
  { name: 'diamond', icon: IconDiamond, color: '#06b6d4' },
  { name: 'hexagon', icon: IconHexagon, color: '#8b5cf6' },
];

interface IconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string; // 当前已应用的图标，用于肤色预览
  onIconChange?: (emoji: string) => void; // 更新图标但不关闭 picker（用于肤色切换）
}

const EmojiButton = memo(function EmojiButton({ 
  emoji, 
  onSelect, 
  onPreview 
}: { 
  emoji: string; 
  onSelect: (e: string) => void; 
  onPreview?: (e: string | null) => void;
}) {
  return (
    <button
      onClick={() => onSelect(emoji)}
      onMouseEnter={() => onPreview?.(emoji)}
      className="w-8 h-8 flex items-center justify-center rounded-md text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {emoji}
    </button>
  );
});


const EmojiCategorySection = memo(function EmojiCategorySection({
  category,
  skinTone,
  onSelect,
  onPreview,
  recentEmojis,
  categoryTitleRef,
  showRecent = true,
}: {
  category: EmojiCategory;
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  recentEmojis: string[];
  categoryTitleRef?: React.RefObject<HTMLDivElement | null>;
  showRecent?: boolean;
}) {
  const emojisWithSkin = useMemo(() => {
    return category.emojis.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [category.emojis, skinTone]);

  // 将最近使用的 emoji 转换为当前皮肤色调
  const recentEmojisWithSkin = useMemo(() => {
    return recentEmojis.map(emoji => {
      // 查找这个 emoji 对应的数据
      for (const cat of EMOJI_CATEGORIES) {
        for (const item of cat.emojis) {
          // 检查是否匹配（可能是默认版本或任何皮肤版本）
          if (item.native === emoji || item.skins?.some(s => s.native === emoji)) {
            if (skinTone === 0 || !item.skins || item.skins.length <= skinTone) {
              return item.native;
            }
            return item.skins[skinTone]?.native || item.native;
          }
        }
      }
      return emoji; // 找不到就返回原 emoji
    });
  }, [recentEmojis, skinTone]);

  return (
    <div className="px-3 py-2">
      {showRecent && recentEmojis.length > 0 && (
        <>
          <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
            最近使用
          </div>
          <div className="grid grid-cols-9 gap-0.5 mb-3">
            {recentEmojisWithSkin.slice(0, MAX_RECENT_EMOJIS).map((emoji, index) => (
              <EmojiButton
                key={`recent-${index}`}
                emoji={emoji}
                onSelect={onSelect}
                onPreview={onPreview}
              />
            ))}
          </div>
        </>
      )}
      
      <div 
        ref={categoryTitleRef}
        className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium"
      >
        {category.name}
      </div>
      <div className="grid grid-cols-9 gap-0.5">
        {emojisWithSkin.map((emoji, index) => (
          <EmojiButton
            key={category.emojis[index].id}
            emoji={emoji}
            onSelect={onSelect}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
});

export function IconPicker({ onSelect, onPreview, onRemove, onClose, hasIcon = false, currentIcon, onIconChange }: IconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryTitleRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('emoji');
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [searchQuery, setSearchQuery] = useState('');
  const [skinTone, setSkinTone] = useState(loadSkinTone);
  const [showSkinTonePicker, setShowSkinTonePicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('people');
  const [previewSkinTone, setPreviewSkinTone] = useState<number | null>(null); // 预览肤色

  // 实际使用的肤色（预览优先）
  const effectiveSkinTone = previewSkinTone !== null ? previewSkinTone : skinTone;

  // 根据 emoji 和肤色获取对应版本
  const getEmojiWithSkinTone = useCallback((emoji: string, tone: number): string | null => {
    if (!emoji || emoji.startsWith('icon:')) return null;
    
    // 从 emoji-mart data 查找这个 emoji
    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (item.native === emoji || item.skins?.some((s: any) => s.native === emoji)) {
          if (tone === 0 || !item.skins || item.skins.length <= tone) {
            return item.native;
          }
          return item.skins[tone]?.native || item.native;
        }
      }
    }
    return emoji; // 找不到就返回原 emoji
  }, []);

  // 悬浮肤色时预览当前图标的对应肤色版本
  const handleSkinToneHover = useCallback((tone: number | null) => {
    setPreviewSkinTone(tone);
    if (tone !== null && currentIcon && !currentIcon.startsWith('icon:')) {
      const previewEmoji = getEmojiWithSkinTone(currentIcon, tone);
      if (previewEmoji) {
        onPreview?.(previewEmoji);
      }
    } else if (tone === null) {
      onPreview?.(null);
    }
  }, [currentIcon, getEmojiWithSkinTone, onPreview]);

  // 切换分类时，非第一个分类自动滚动到分类标题
  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    // 使用 requestAnimationFrame 确保 DOM 更新后立即滚动
    requestAnimationFrame(() => {
      if (categoryId !== 'people') {
        if (categoryTitleRef.current && scrollContainerRef.current) {
          categoryTitleRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      } else {
        // 第一个分类滚动到顶部
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
    });
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase();
    const results: EmojiItem[] = [];
    
    for (const cat of EMOJI_CATEGORIES) {
      for (const emoji of cat.emojis) {
        if (
          emoji.name.toLowerCase().includes(query) ||
          emoji.id.toLowerCase().includes(query) ||
          emoji.keywords.some(k => k.toLowerCase().includes(query))
        ) {
          results.push(emoji);
        }
      }
    }
    
    return results;
  }, [searchQuery]);

  const recentEmojis = recentIcons.filter(i => !i.startsWith('icon:')).slice(0, MAX_RECENT_EMOJIS);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const updated = addToRecentIcons(emoji, recentIcons);
    setRecentIcons(updated);
    onSelect(emoji);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handlePreview = useCallback((emoji: string | null) => {
    onPreview?.(emoji);
  }, [onPreview]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onPreview?.(null);
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, onPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreview?.(null);
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPreview]);

  useEffect(() => {
    if (activeTab === 'emoji') {
      searchInputRef.current?.focus();
    }
  }, [activeTab]);

  const handleIconSelect = (iconName: string, color: string) => {
    const iconValue = `icon:${iconName}:${color}`;
    const updated = addToRecentIcons(iconValue, recentIcons);
    setRecentIcons(updated);
    onSelect(iconValue);
    onClose();
  };

  const handleRemove = () => {
    onRemove?.();
    onClose();
  };

  const handleSkinToneChange = (tone: number) => {
    setSkinTone(tone);
    saveSkinTone(tone);
    setShowSkinTonePicker(false);
    setPreviewSkinTone(null);
    onPreview?.(null); // 清除父组件的预览状态
    
    // 如果当前有图标，更新为对应肤色版本（不关闭 picker）
    if (currentIcon && !currentIcon.startsWith('icon:')) {
      const newEmoji = getEmojiWithSkinTone(currentIcon, tone);
      if (newEmoji && newEmoji !== currentIcon) {
        onIconChange?.(newEmoji);
      }
    }
  };


  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute z-50 shadow-lg rounded-lg overflow-hidden",
        "border border-[var(--neko-border)] bg-white dark:bg-zinc-900",
        "w-[352px]"
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--neko-border)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('emoji')}
            className={cn(
              "text-sm font-medium pb-1 border-b-2 transition-colors",
              activeTab === 'emoji'
                ? "text-[var(--neko-accent)] border-[var(--neko-accent)]"
                : "text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            Emoji
          </button>
          <button
            onClick={() => setActiveTab('icons')}
            className={cn(
              "text-sm font-medium pb-1 border-b-2 transition-colors",
              activeTab === 'icons'
                ? "text-[var(--neko-accent)] border-[var(--neko-accent)]"
                : "text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            Icons
          </button>
        </div>
        {hasIcon && onRemove && (
          <button
            onClick={handleRemove}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {activeTab === 'emoji' ? (
        <div>
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <div className="flex-1 relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-8 pr-3 py-1.5 text-sm rounded-md",
                  "bg-zinc-100 dark:bg-zinc-800",
                  "border border-transparent focus:border-[var(--neko-accent)]",
                  "outline-none transition-colors"
                )}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSkinTonePicker(!showSkinTonePicker)}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center text-base",
                  "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                )}
                title="选择皮肤色调"
              >
                {SKIN_TONES[skinTone].emoji}
              </button>
              {showSkinTonePicker && (
                <div className={cn(
                  "absolute right-0 top-full mt-1 p-2 rounded-lg shadow-lg z-10",
                  "bg-white dark:bg-zinc-800 border border-[var(--neko-border)]",
                  "flex gap-1"
                )}>
                  {SKIN_TONES.map((st) => (
                    <button
                      key={st.tone}
                      onClick={() => handleSkinToneChange(st.tone)}
                      onMouseEnter={() => handleSkinToneHover(st.tone)}
                      onMouseLeave={() => handleSkinToneHover(null)}
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center text-lg transition-all",
                        skinTone === st.tone 
                          ? "bg-zinc-200 dark:bg-zinc-700 scale-110" 
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:scale-105"
                      )}
                    >
                      {st.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            className="max-h-[280px] overflow-y-auto neko-scrollbar"
            onMouseLeave={() => onPreview?.(null)}
          >
            {searchQuery && searchResults && (
              <div className="px-3 py-2">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
                  搜索结果 ({searchResults.length})
                </div>
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-9 gap-0.5">
                    {searchResults.slice(0, 90).map((emoji) => {
                      const displayEmoji = effectiveSkinTone === 0 || !emoji.skins || emoji.skins.length <= effectiveSkinTone
                        ? emoji.native
                        : emoji.skins[effectiveSkinTone]?.native || emoji.native;
                      return (
                        <EmojiButton
                          key={emoji.id}
                          emoji={displayEmoji}
                          onSelect={handleEmojiSelect}
                          onPreview={handlePreview}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                    没有找到匹配的 emoji
                  </div>
                )}
              </div>
            )}
            
            {/* 预渲染所有分类，但只显示当前分类 */}
            {!searchQuery && EMOJI_CATEGORIES.map((category, index) => (
              <div 
                key={category.id} 
                style={{ display: activeCategory === category.id ? 'block' : 'none' }}
              >
                <EmojiCategorySection
                  category={category}
                  skinTone={effectiveSkinTone}
                  onSelect={handleEmojiSelect}
                  onPreview={handlePreview}
                  recentEmojis={recentEmojis}
                  categoryTitleRef={activeCategory === category.id ? categoryTitleRef : undefined}
                  showRecent={index === 0 || activeCategory === category.id}
                />
              </div>
            ))}
          </div>

          {!searchQuery && (
            <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--neko-border)] bg-zinc-50 dark:bg-zinc-800/50">
              {EMOJI_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-md text-lg transition-colors",
                    activeCategory === category.id
                      ? "bg-zinc-200 dark:bg-zinc-700"
                      : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                >
                  {CATEGORY_ICONS[category.id]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div 
          className="p-3 max-h-[320px] overflow-y-auto neko-scrollbar"
          onMouseLeave={() => onPreview?.(null)}
        >
          <div className="grid grid-cols-8 gap-1">
            {ICON_LIST.map((item) => {
              const IconComponent = item.icon;
              const iconValue = `icon:${item.name}:${item.color}`;
              return (
                <button
                  key={item.name}
                  onClick={() => handleIconSelect(item.name, item.color)}
                  onMouseEnter={() => onPreview?.(iconValue)}
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-md",
                    "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  )}
                >
                  <IconComponent size={20} style={{ color: item.color }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
