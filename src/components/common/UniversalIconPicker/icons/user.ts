import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Most common user
  'User', 'Users', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'Mail', 'Phone', 'MessageCircle', 'MessageSquare',
  'Heart', 'Star', 'ThumbsUp', 'ThumbsDown', 'Share', 'Bell', 'Settings', 'Lock', 'Eye', 'Camera', 'Mic',
  'Smile', 'Send', 'AtSign', 'Link', 'Globe', 'Building', 'Briefcase', 'Award', 'Trophy',
  // User variants
  'UserCircle', 'UserCircle2', 'UserSquare', 'UserSquare2', 'UserRound', 'UserRoundCheck', 'UserRoundCog', 'UserRoundMinus', 'UserRoundPlus',
  'UserRoundSearch', 'UserRoundX', 'UserRoundPen', 'CircleUser', 'CircleUserRound', 'SquareUser', 'SquareUserRound',
  'UserPlus2', 'UserMinus2', 'UserCheck2', 'UserX2', 'UserCog', 'UserCog2', 'UserSearch', 'UserPen',
  'UsersRound', 'Users2', 'User2', 'Contact', 'Contact2', 'ContactRound', 'BookUser', 'IdCard', 'IdCardLanyard',
  'Badge', 'BadgeCheck', 'BadgeX', 'BadgeAlert', 'BadgeInfo', 'BadgeHelp', 'BadgePlus', 'BadgeMinus', 'ShieldUser', 'UserLock', 'UserStar',
  // Emotions
  'SmilePlus', 'Frown', 'Meh', 'Laugh', 'Angry', 'Annoyed',
  // Body
  'Hand', 'HandMetal', 'HandCoins', 'HandHeart', 'HandHelping', 'HandPlatter', 'Handshake', 'BicepsFlexed',
  'Ear', 'EarOff', 'EyeOff', 'EyeClosed', 'Brain', 'BrainCircuit', 'BrainCog',
  'HeartHandshake', 'HeartPulse', 'HeartCrack', 'HeartOff', 'HeartPlus', 'HeartMinus', 'Footprints', 'Fingerprint',
  'Baby', 'PersonStanding', 'Accessibility',
  // Professions
  'BriefcaseBusiness', 'BriefcaseMedical', 'BriefcaseConveyorBelt', 'GraduationCap', 'School', 'BookOpen',
  'Stethoscope', 'Syringe', 'Pill', 'Tablets', 'Gavel', 'Scale', 'Landmark', 'HardHat', 'Wrench', 'Hammer',
  'ChefHat', 'UtensilsCrossed', 'CookingPot', 'Shirt', 'HatGlasses', 'Handbag',
  // Communication
  'PhoneCall', 'PhoneForwarded', 'PhoneIncoming', 'PhoneMissed', 'PhoneOff', 'PhoneOutgoing', 'Smartphone', 'SmartphoneCharging', 'SmartphoneNfc', 'Voicemail',
  'Video', 'VideoOff', 'Webcam', 'CameraOff', 'MicOff', 'Mic2', 'MicVocal',
  'MessageCirclePlus', 'MessageCircleQuestion', 'MessageCircleWarning', 'MessageCircleCode', 'MessageCircleDashed', 'MessageCircleHeart', 'MessageCircleMore',
  'MessageCircleOff', 'MessageCircleReply', 'MessageCircleX',
  'MessageSquarePlus', 'MessageSquareText', 'MessageSquareQuote', 'MessageSquareCode', 'MessageSquareDashed', 'MessageSquareHeart', 'MessageSquareMore',
  'MessageSquareOff', 'MessageSquareReply', 'MessageSquareShare', 'MessageSquareWarning', 'MessageSquareX', 'MessageSquareDiff', 'MessageSquareDot', 'MessageSquareLock', 'MessagesSquare',
  'MailOpen', 'MailPlus', 'MailMinus', 'MailCheck', 'MailX', 'MailQuestion', 'MailWarning', 'MailSearch', 'Mails',
  'Inbox', 'SendHorizontal', 'SendToBack', 'Forward', 'Reply', 'ReplyAll', 'Paperclip',
  // Social
  'Share2', 'BellRing', 'BellOff', 'BellPlus', 'BellMinus', 'BellDot', 'BellElectric', 'StarOff',
  'Unlock', 'Shield', 'ShieldOff', 'Ban', 'Group', 'Network', 'Building2', 'Castle',
  'PartyPopper', 'Cake', 'CakeSlice', 'Gift', 'Sparkles', 'Medal', 'Crown',
  'Ticket', 'TicketCheck', 'TicketMinus', 'TicketPlus', 'TicketX', 'TicketPercent', 'TicketSlash',
  'Speech', 'Quote', 'TextQuote', 'Megaphone', 'MegaphoneOff', 'Languages', 'Globe2', 'Captions', 'CaptionsOff', 'AudioLines',
  'Drama', 'Ghost', 'Bot', 'BotMessageSquare', 'BotOff', 'Skull', 'Glasses', 'RectangleGoggles',
  'Mars', 'MarsStroke', 'Venus', 'VenusAndMars', 'NonBinary', 'Transgender', 'Vote', 'Cigarette', 'CigaretteOff', 'HelpingHand',
];

export const userIcons: IconCategory = { id: 'user', name: 'User & Social', emoji: getIcon('Users'), icons: createIconItems(ICONS) };
