import { useState, useRef, useEffect } from 'react';
import {
  // Activity
  Barbell, Target, TrendUp, Lightning, Trophy, Medal, Flag, Pulse, Fire,
  Footprints, Sneaker, SwimmingPool, Basketball, Mountains, Bicycle,
  SoccerBall, Football, TennisBall, Volleyball, Baseball, BowlingBall, BoxingGlove,
  // Health
  Heart, Brain, Moon, Sun, Smiley, Sparkle,
  Bed, Pill, FirstAidKit, Syringe, Thermometer, Stethoscope, Bandaids,
  // Food
  Coffee, ForkKnife, Pizza, Hamburger, Cookie, IceCream, Martini, Wine, BeerBottle, Cake, Popcorn, CookingPot, AppleLogo, Carrot,
  // Work & Tech
  Briefcase, GraduationCap, Book, Pen, Code, Laptop, Desktop, Mouse, Keyboard,
  Calculator, ChartBar, Rocket, Lightbulb, Bank, Robot, Cpu, WifiHigh, BatteryCharging,
  DeviceTablet, Watch, DeviceMobile, HardDrives, Usb, Printer,
  // Life & Arts
  House, Camera, ShoppingBag, Gift, Ticket,
  Armchair, Baby, FilmStrip, Palette, Ghost, ChatCircle,
  PaintBrush, Pencil, Guitar, Microphone, Headphones, MusicNote, GameController,
  Television, Radio, SpeakerHifi, CassetteTape, Disc, VinylRecord, DiceFive, MagicWand,
  // Nature & Animals
  Plant, Flower, Drop, Tree, Cactus, Waves, Wind, CloudRain, Snowflake, Umbrella, Rainbow, FireSimple,
  Cat, Dog, Bird, Fish, PawPrint, Butterfly,
  TreePalm, TreeEvergreen, SunHorizon, CloudSun, CloudLightning,
  // Travel
  Airplane, Car, MapTrifold, Compass, Globe,
  Bus, Train, Boat, Suitcase, Binoculars, Truck, Motorcycle, Scooter, Jeep, FlyingSaucer,
  Taxi, Tram, Subway, Parachute, Sailboat,
  // Tools & Objects
  Clock, CalendarBlank, Wrench, Hammer, Key, Lock, Bell, Gear,
  Tag, Paperclip, PushPin, Scissors, Trash, Broom, Shower, Lamp,
  // Clothing
  TShirt, Hoodie, CoatHanger, Dress, HighHeel, Eyeglasses, Sunglasses, BaseballCap,
  // Finance
  CurrencyDollar, PiggyBank, CreditCard, Wallet,
  type Icon as PhosphorIcon,
  CaretLeft, Prohibit
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

// Categorized Icons
// NOTE: We do NOT include the "None" option here. It is handled purely in the UI.
const ICON_CATEGORIES = [
  {
    name: 'Activity',
    icons: [
      { name: 'dumbbell', icon: Barbell },
      { name: 'activity', icon: Pulse },
      { name: 'flame', icon: Fire },
      { name: 'target', icon: Target },
      { name: 'trending', icon: TrendUp },
      { name: 'trophy', icon: Trophy },
      { name: 'award', icon: Medal },
      { name: 'flag', icon: Flag },
      { name: 'zap', icon: Lightning },
      { name: 'steps', icon: Footprints },
      { name: 'run', icon: Sneaker },
      { name: 'swim', icon: SwimmingPool },
      { name: 'hike', icon: Mountains },
      { name: 'cycling', icon: Bicycle },
      { name: 'soccer', icon: SoccerBall },
      { name: 'football', icon: Football },
      { name: 'basketball', icon: Basketball },
      { name: 'tennis', icon: TennisBall },
      { name: 'volley', icon: Volleyball },
      { name: 'baseball', icon: Baseball },
      { name: 'bowling', icon: BowlingBall },
      { name: 'boxing', icon: BoxingGlove },
    ]
  },
  {
    name: 'Health',
    icons: [
      { name: 'heart', icon: Heart },
      { name: 'brain', icon: Brain },
      { name: 'smile', icon: Smiley },
      { name: 'moon', icon: Moon },
      { name: 'sun', icon: Sun },
      { name: 'sleep', icon: Bed },
      { name: 'pill', icon: Pill },
      { name: 'firstaid', icon: FirstAidKit },
      { name: 'syringe', icon: Syringe },
      { name: 'thermo', icon: Thermometer },
      { name: 'stethoscope', icon: Stethoscope },
      { name: 'bandaid', icon: Bandaids },
    ]
  },
  {
    name: 'Food',
    icons: [
      { name: 'coffee', icon: Coffee },
      { name: 'utensils', icon: ForkKnife },
      { name: 'pizza', icon: Pizza },
      { name: 'burger', icon: Hamburger },
      { name: 'cookie', icon: Cookie },
      { name: 'icecream', icon: IceCream },
      { name: 'martini', icon: Martini },
      { name: 'wine', icon: Wine },
      { name: 'beer', icon: BeerBottle },
      { name: 'cake', icon: Cake },
      { name: 'popcorn', icon: Popcorn },
      { name: 'cooking', icon: CookingPot },
      { name: 'apple', icon: AppleLogo },
      { name: 'carrot', icon: Carrot },
    ]
  },
  {
    name: 'Work & Tech',
    icons: [
      { name: 'briefcase', icon: Briefcase },
      { name: 'grad', icon: GraduationCap },
      { name: 'book', icon: Book },
      { name: 'pen', icon: Pen },
      { name: 'code', icon: Code },
      { name: 'laptop', icon: Laptop },
      { name: 'desktop', icon: Desktop },
      { name: 'mouse', icon: Mouse },
      { name: 'keyboard', icon: Keyboard },
      { name: 'tablet', icon: DeviceTablet },
      { name: 'phone', icon: DeviceMobile },
      { name: 'watch', icon: Watch },
      { name: 'calc', icon: Calculator },
      { name: 'chart', icon: ChartBar },
      { name: 'rocket', icon: Rocket },
      { name: 'idea', icon: Lightbulb },
      { name: 'bank', icon: Bank },
      { name: 'robot', icon: Robot },
      { name: 'cpu', icon: Cpu },
      { name: 'wifi', icon: WifiHigh },
      { name: 'battery', icon: BatteryCharging },
      { name: 'drive', icon: HardDrives },
      { name: 'usb', icon: Usb },
      { name: 'printer', icon: Printer },
    ]
  },
  {
    name: 'Life & Arts',
    icons: [
      { name: 'home', icon: House },
      { name: 'camera', icon: Camera },
      { name: 'shopping', icon: ShoppingBag },
      { name: 'gift', icon: Gift },
      { name: 'ticket', icon: Ticket },
      { name: 'relax', icon: Armchair },
      { name: 'baby', icon: Baby },
      { name: 'movie', icon: FilmStrip },
      { name: 'tv', icon: Television },
      { name: 'radio', icon: Radio },
      { name: 'art', icon: Palette },
      { name: 'ghost', icon: Ghost },
      { name: 'game', icon: GameController },
      { name: 'dice', icon: DiceFive },
      { name: 'magic', icon: MagicWand },
      { name: 'chat', icon: ChatCircle },
      { name: 'paint', icon: PaintBrush },
      { name: 'draw', icon: Pencil },
      { name: 'guitar', icon: Guitar },
      { name: 'mic', icon: Microphone },
      { name: 'headphones', icon: Headphones },
      { name: 'music', icon: MusicNote },
      { name: 'speaker', icon: SpeakerHifi },
      { name: 'cassette', icon: CassetteTape },
      { name: 'vinyl', icon: VinylRecord },
      { name: 'disc', icon: Disc },
    ]
  },
  {
    name: 'Nature & Animals',
    icons: [
      { name: 'plant', icon: Plant },
      { name: 'flower', icon: Flower },
      { name: 'tree', icon: Tree },
      { name: 'palm', icon: TreePalm },
      { name: 'pine', icon: TreeEvergreen },
      { name: 'cactus', icon: Cactus },
      { name: 'sun-h', icon: SunHorizon },
      { name: 'drop', icon: Drop },
      { name: 'waves', icon: Waves },
      { name: 'wind', icon: Wind },
      { name: 'rain', icon: CloudRain },
      { name: 'cloud-sun', icon: CloudSun },
      { name: 'snow', icon: Snowflake },
      { name: 'storm', icon: CloudLightning },
      { name: 'umbrella', icon: Umbrella },
      { name: 'rainbow', icon: Rainbow },
      { name: 'fire', icon: FireSimple },
      { name: 'cat', icon: Cat },
      { name: 'dog', icon: Dog },
      { name: 'bird', icon: Bird },
      { name: 'fish', icon: Fish },
      { name: 'paw', icon: PawPrint },
      { name: 'butterfly', icon: Butterfly },
    ]
  },
  {
    name: 'Travel',
    icons: [
      { name: 'plane', icon: Airplane },
      { name: 'car', icon: Car },
      { name: 'taxi', icon: Taxi },
      { name: 'bus', icon: Bus },
      { name: 'train', icon: Train },
      { name: 'subway', icon: Subway },
      { name: 'tram', icon: Tram },
      { name: 'truck', icon: Truck },
      { name: 'moto', icon: Motorcycle },
      { name: 'scooter', icon: Scooter },
      { name: 'jeep', icon: Jeep },
      { name: 'bike', icon: Bicycle },
      { name: 'boat', icon: Boat },
      { name: 'ship', icon: Sailboat },
      { name: 'ufo', icon: FlyingSaucer },
      { name: 'map', icon: MapTrifold },
      { name: 'compass', icon: Compass },
      { name: 'globe', icon: Globe },
      { name: 'luggage', icon: Suitcase },
      { name: 'view', icon: Binoculars },
      { name: 'chute', icon: Parachute },
    ]
  },
  {
    name: 'Clothing',
    icons: [
      { name: 'tshirt', icon: TShirt },
      { name: 'hoodie', icon: Hoodie },
      { name: 'dress', icon: Dress },
      { name: 'hanger', icon: CoatHanger },
      { name: 'heels', icon: HighHeel },
      { name: 'glasses', icon: Eyeglasses },
      { name: 'shades', icon: Sunglasses },
      { name: 'cap', icon: BaseballCap },
    ]
  },
  {
    name: 'Tools & Objects',
    icons: [
      { name: 'clock', icon: Clock },
      { name: 'calendar', icon: CalendarBlank },
      { name: 'wrench', icon: Wrench },
      { name: 'hammer', icon: Hammer },
      { name: 'key', icon: Key },
      { name: 'lock', icon: Lock },
      { name: 'bell', icon: Bell },
      { name: 'gear', icon: Gear },
      { name: 'tag', icon: Tag },
      { name: 'clip', icon: Paperclip },
      { name: 'pin', icon: PushPin },
      { name: 'cut', icon: Scissors },
      { name: 'trash', icon: Trash },
      { name: 'clean', icon: Broom },
      { name: 'shower', icon: Shower },
      { name: 'lamp', icon: Lamp },
      { name: 'dollar', icon: CurrencyDollar },
      { name: 'piggy', icon: PiggyBank },
      { name: 'card', icon: CreditCard },
      { name: 'wallet', icon: Wallet },
    ]
  }
];

// Flatten for quick lookup
const ALL_ICONS = ICON_CATEGORIES.flatMap(c => c.icons);

export function getIconByName(name: string): PhosphorIcon | null {
  const found = ALL_ICONS.find(i => i.name === name);
  return found?.icon || null;
}

export function IconSelectionView({ value, onChange, onCancel }: { value?: string, onChange: (icon: string | undefined) => void, onCancel?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* 1. Minimal Header */}
      <div className="flex justify-start items-center mb-4 px-2 shrink-0 h-10">
        {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 -ml-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Back"
            >
              <CaretLeft weight="bold" className="size-5" />
            </button>
        )}
      </div>

      {/* 2. Pure Icon Grid */}
      <div className="
        flex-1 overflow-y-auto pb-8 -mx-4 px-4
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:bg-zinc-100
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:hover:bg-zinc-300
        dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800
        dark:[&::-webkit-scrollbar-thumb]:hover:bg-zinc-700
      ">
        <div className="grid grid-cols-5 gap-4 py-2">
          {/* The "None" Option - Manually Inserted */}
          <button
            onClick={() => onChange(undefined)}
            className={`
              group relative aspect-square rounded-2xl flex items-center justify-center transition-all duration-300
              ${!value 
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xl scale-110 z-10' 
                : 'bg-transparent text-zinc-300 dark:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 hover:scale-110'
              }
            `}
            title="No Icon"
          >
            <Prohibit 
              className={`transition-transform duration-300 ${!value ? 'size-6 opacity-100' : 'size-6 opacity-40 group-hover:opacity-100'}`}
              weight={!value ? "bold" : "regular"}
            />
          </button>

          {ALL_ICONS.map(({ name, icon: Icon }) => {
            const isSelected = value === name;
            return (
              <button
                key={name}
                onClick={() => onChange(name)}
                className={`
                  group relative aspect-square rounded-2xl flex items-center justify-center transition-all duration-300
                  ${isSelected
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xl scale-110 z-10' 
                    : 'bg-transparent text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 hover:scale-110'
                  }
                `}
                title={name}
              >
                <Icon 
                  className="size-7 transition-transform duration-300" 
                  weight={isSelected ? "duotone" : "light"}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface IconPickerProps {
  value?: string;
  onChange: (icon: string | undefined) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const SelectedIcon = value ? getIconByName(value) : null;

  return (
    <div className="relative z-50">
      {/* Trigger Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className={`
          relative w-14 h-14 flex items-center justify-center rounded-full transition-all duration-300
          ${SelectedIcon 
            ? 'bg-white dark:bg-zinc-800 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:ring-white/10' 
            : 'bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-700 shadow-sm hover:shadow-md'
          }
        `}
      >
        {SelectedIcon ? (
          <div className="text-zinc-900 dark:text-zinc-100">
             <SelectedIcon className="size-6" weight="duotone" />
          </div>
        ) : (
          <Sparkle className="size-6 text-zinc-400 dark:text-zinc-500 opacity-80" weight="light" />
        )}
        
        {open && (
           <motion.div 
             layoutId="active-ring"
             className="absolute -inset-1 rounded-full border border-zinc-900/20 dark:border-zinc-100/20 opacity-100 pointer-events-none"
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.8 }}
           />
        )}
      </motion.button>

      {/* Center Stage Icon Panel (Fixed Overlay) */}
      <AnimatePresence>
        {open && (
          <>
            {/* Invisible Backdrop to catch clicks */}
            <div 
                className="fixed inset-0 z-[60]" 
                onClick={() => setOpen(false)}
            />

            {/* The Floating Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 850, damping: 35, mass: 0.5 }}
              className="
                fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
                w-[380px] max-h-[500px] 
                bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl 
                rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] 
                border border-white/40 dark:border-white/10
                overflow-hidden
                flex flex-col
              "
            >
              <div className="p-6 h-full overflow-hidden flex flex-col">
                 <IconSelectionView value={value} onChange={(v) => { onChange(v); setOpen(false); }} onCancel={() => setOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

