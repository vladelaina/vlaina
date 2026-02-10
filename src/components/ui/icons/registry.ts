import { ComponentType, SVGProps } from 'react';
// Lucide Imports (Primary Set)
import { 
  SquarePen, Trash2, User, LogOut, Moon, Sun, Laptop, 
  Check, X, ChevronRight, ChevronDown, ChevronLeft, ChevronUp,
  Plus, MoreVertical, Home, Folder,
  FolderOpen, CloudOff, RefreshCw, Lock, Globe, Archive, Upload,
  Image as ImageIcon, Copy, ExternalLink, Link2Off, Crop, Download,
  ImageOff, Code, Share2, Star, Palette, Keyboard, FileText, Clock,
  Cloud, ArrowLeft, ArrowUpRight, ArrowRight, Info, AlertCircle, AlertTriangle,
  Play, Pause, StopCircle, Languages, Paperclip, Send, RotateCcw,
  Maximize, Minimize, List, ListOrdered, CheckSquare,
  Square, ShieldAlert, Heart, Activity, FileInput, Mic, Volume2, Minus, CheckCircle, Type, Shuffle,
  Pin, FilePlus, Columns2, ImagePlus, AlignLeft, AlignCenter, AlignRight, MapPin, Ban, Film, Users, Circle, PanelLeft, Flag
} from 'lucide-react';

// React Icons Imports (Secondary/Specific Set)
import { 
  MdCalendarToday, MdOutlinePieChart, MdOutlineAssignment, 
  MdOutlineCheckCircle, MdDragIndicator, MdKeyboardDoubleArrowLeft,
  MdKeyboardDoubleArrowRight, MdAutoAwesome, MdAccountTree, 
  MdCollections, MdEditCalendar, MdLabel, MdUnfoldMore, 
  MdSelectAll, MdPushPin, MdDriveFileRenameOutline, MdWbSunny,
  MdAddToPhotos, MdContentCut, MdSwapVert, MdAddTask
} from 'react-icons/md';

// Heroicons Imports
import { 
  BeakerIcon, ArchiveBoxIcon, MagnifyingGlassIcon, CogIcon, EllipsisHorizontalIcon, EllipsisVerticalIcon,
  ChevronDoubleLeftIcon, ChevronDoubleRightIcon, Bars3Icon
} from '@heroicons/react/24/outline';

// Custom Icons
import { NewChatIcon } from './custom';

export type IconSource = ComponentType<SVGProps<SVGSVGElement>>;

export const icons = {
  // --- Window Controls ---
  'window.minimize': Minus,
  'window.maximize': Square,
  'window.close': X,

  // --- Common Actions ---
  'common.add': Plus,
  'common.delete': Trash2,
  'common.remove': Minus,
  'common.edit': NewChatIcon,
  'common.settings': CogIcon,
  'common.search': MagnifyingGlassIcon,
  'common.close': X,
  'common.check': Check,
  'common.checkCircle': CheckCircle,
  'common.radio': Circle,
  'common.home': Home,
  'common.more': EllipsisHorizontalIcon,
  'common.moreVert': EllipsisVerticalIcon,
  'common.drag': MdDragIndicator,
  'common.refresh': RefreshCw,
  'common.copy': Copy,
  'common.download': Download,
  'common.upload': Upload,
  'common.share': Share2,
  'common.menu': Bars3Icon,
  'common.list': List,
  'common.filter': List, // Temporary mapping
  'common.sort': MdSwapVert,
  'common.flag': Flag,
  'common.undo': RotateCcw,
  'common.info': Info,
  'common.warning': AlertTriangle,
  'common.error': AlertCircle, // or ShieldAlert
  'common.blocked': ShieldAlert,
  'common.block': Ban,
  'common.compose': NewChatIcon,

  // --- Navigation ---
  'nav.chevronRight': ChevronRight,
  'nav.chevronLeft': ChevronLeft,
  'nav.chevronDown': ChevronDown,
  'nav.chevronUp': ChevronUp,
  'nav.arrowRight': ArrowRight,
  'nav.arrowLeft': ArrowLeft,
  'nav.arrowUpRight': ArrowUpRight,
  'nav.back': ArrowLeft,
  'nav.collapse': ChevronDoubleLeftIcon,
  'nav.expand': ChevronDoubleRightIcon,
  'nav.fullscreen': Maximize,
  'nav.exitFullscreen': Minimize,
  'nav.split': Columns2,
  'nav.external': ExternalLink,
  'nav.location': MapPin,

  // --- Sidebar/App Modules ---
  'sidebar.todo': MdOutlineAssignment,
  'sidebar.calendar': MdCalendarToday,
  'sidebar.stats': MdOutlinePieChart,
  'sidebar.completed': MdOutlineCheckCircle,
  'sidebar.collapse': ChevronDoubleLeftIcon,
  'sidebar.panel': PanelLeft,
  
  // --- User/Auth ---
  'user.profile': User,
  'user.logout': LogOut,
  'user.person': User,
  'user.switch': Users,

  // --- Theme/Appearance ---
  'theme.light': Sun,
  'theme.dark': Moon,
  'theme.system': Laptop,
  'theme.palette': Palette,
  'theme.sunny': MdWbSunny,

  // --- Files & Folders ---
  'file.folder': Folder,
  'file.folderOpen': FolderOpen,
  'file.add': FilePlus,
  'file.text': FileText,
  'file.image': ImageIcon,
  'file.imagePlus': ImagePlus,
  'file.brokenImage': ImageOff,
  'file.archive': Archive,
  'file.cloud': Cloud,
  'file.cloudOff': CloudOff,
  'file.lock': Lock,
  'file.public': Globe,
  'file.attach': Paperclip,
  'file.input': FileInput,

  // --- Editor/Content ---
  'editor.linkOff': Link2Off,
  'editor.crop': Crop,
  'editor.code': Code,
  'editor.keyboard': Keyboard,
  'editor.cut': MdContentCut,
  'editor.list': List,
  'editor.listOrdered': ListOrdered,
  'editor.checkSquare': CheckSquare,
  'editor.square': Square,
  'editor.type': Type,
  'editor.alignLeft': AlignLeft,
  'editor.alignCenter': AlignCenter,
  'editor.alignRight': AlignRight,

  // --- Media ---
  'media.play': Play,
  'media.pause': Pause,
  'media.stop': StopCircle,
  'media.mic': Mic,
  'media.volume': Volume2,

  // --- Chat/AI ---
  'ai.sparkle': MdAutoAwesome,
  'ai.send': Send,
  'ai.language': Languages,
  'ai.pin': MdPushPin,
  'ai.pinOutline': Pin,
  'ai.rename': MdDriveFileRenameOutline,

  // --- Misc/Specific ---
  'misc.clock': Clock,
  'misc.star': Star,
  'misc.heart': Heart,
  'misc.shuffle': Shuffle,
  'misc.activity': Activity, // MonitorHeart
  'misc.animation': Film,
  'misc.lab': BeakerIcon,
  'misc.box': ArchiveBoxIcon,
  
  // --- Legacy Mappings (To be refined) ---
  'legacy.accountTree': MdAccountTree,
  'legacy.collections': MdCollections,
  'legacy.editCalendar': MdEditCalendar,
  'legacy.label': MdLabel,
  'legacy.unfold': MdUnfoldMore,
  'legacy.selectAll': MdSelectAll,
  'legacy.addToPhotos': MdAddToPhotos,
  'legacy.addTask': MdAddTask,

} as const;

export type IconName = keyof typeof icons;