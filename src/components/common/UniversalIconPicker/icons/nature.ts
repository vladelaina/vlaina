import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  // Most common nature icons first
  'Sun', 'Moon', 'Cloud', 'Star', 'Leaf', 'Flower', 'Zap', 'Flame', 'Coffee', 'Droplet',
  'Thermometer', 'Wind', 'Snowflake', 'Mountain', 'Cat', 'Dog', 'Apple', 'Brain', 'TreePine', 'Rainbow',
  // Weather
  'SunDim', 'SunMedium', 'SunMoon', 'Sunrise', 'Sunset', 'MoonStar', 'Eclipse',
  'CloudSun', 'CloudMoon', 'Cloudy', 'CloudRain', 'CloudRainWind', 'CloudDrizzle', 'CloudSnow', 'CloudHail',
  'CloudLightning', 'CloudFog', 'CloudOff', 'CloudAlert', 'CloudCheck', 'CloudCog', 'CloudDownload', 'CloudUpload', 'CloudMoonRain', 'CloudSunRain', 'MonitorCloud',
  'WindArrowDown', 'Tornado', 'Rainbow', 'Umbrella', 'UmbrellaOff',
  'ThermometerSun', 'ThermometerSnowflake', 'Droplets', 'DropletOff', 'Haze', 'SunSnow',
  // Plants
  'Sprout', 'LeafyGreen', 'Clover', 'Shrub', 'TreePine', 'TreeDeciduous', 'Trees', 'Palmtree', 'TreePalm',
  'Flower2', 'Rose', 'Cannabis', 'Hop', 'HopOff', 'Wheat', 'WheatOff',
  // Elements
  'FlameKindling', 'FireExtinguisher', 'ZapOff', 'Waves', 'WavesArrowDown', 'WavesArrowUp', 'WavesLadder',
  'MountainSnow', 'Tent', 'TentTree', 'Compass', 'Dam', 'Radar',
  // Animals
  'Rabbit', 'Squirrel', 'Rat', 'Panda', 'Bird', 'Birdhouse', 'Egg', 'EggFried', 'EggOff', 'Feather',
  'Fish', 'FishOff', 'FishSymbol', 'Shell', 'Snail', 'Shrimp', 'Bug', 'BugOff', 'BugPlay', 'Turtle', 'Worm', 'PawPrint', 'Bone', 'Footprints',
  // Food
  'Cherry', 'Citrus', 'Grape', 'Banana', 'Carrot', 'Salad', 'Bean', 'BeanOff',
  'Pizza', 'Sandwich', 'Hamburger', 'Beef', 'Ham', 'Drumstick', 'Soup', 'CookingPot', 'UtensilsCrossed', 'ChefHat',
  'Croissant', 'Donut', 'Cookie', 'Cake', 'CakeSlice', 'Dessert', 'IceCream', 'IceCream2', 'IceCreamBowl', 'IceCreamCone', 'Popsicle',
  'Candy', 'CandyCane', 'CandyOff', 'Lollipop', 'Popcorn',
  // Drinks
  'CupSoda', 'GlassWater', 'Milk', 'MilkOff', 'Beer', 'BeerOff', 'Wine', 'WineOff', 'Martini', 'BottleWine', 'Amphora',
  'Utensils', 'ForkKnife', 'ForkKnifeCrossed', 'PocketKnife', 'Refrigerator', 'Microwave', 'SoapDispenserDroplet',
  'Vegan', 'Nut', 'NutOff',
  // Environment
  'Globe', 'Globe2', 'GlobeLock', 'Earth', 'EarthLock', 'Recycle', 'Biohazard', 'Radiation',
  'Heart', 'Stars', 'Sparkle', 'Sparkles', 'Orbit', 'Satellite', 'SatelliteDish', 'Telescope', 'Rocket', 'Atom',
  // Science
  'FlaskConical', 'FlaskConicalOff', 'FlaskRound', 'Beaker', 'TestTube', 'TestTubes', 'TestTube2', 'Microscope', 'Dna', 'DnaOff',
  'BrainCircuit', 'BrainCog', 'Magnet', 'Gem', 'Diamond', 'Anchor', 'Barrel', 'Cylinder', 'Cone', 'Cuboid', 'Shapes', 'Diameter', 'Radius',
  'Ruler', 'Scale', 'Scale3D', 'Scale3d', 'DraftingCompass', 'Triangle', 'TriangleRight', 'Square', 'SquareDashed', 'Circle', 'CircleDashed',
  'Pentagon', 'Hexagon', 'Octagon', 'Infinity', 'Pi', 'Sigma', 'Percent', 'Hash', 'Binary', 'Dumbbell', 'Weight',
];

export const natureIcons: IconCategory = { id: 'nature', name: 'Nature', emoji: getIcon('Leaf'), icons: createIconItems(ICONS) };
