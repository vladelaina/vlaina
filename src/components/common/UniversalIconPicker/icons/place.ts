import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  'Place', 'Map', 'NearMe', 'PinDrop', 'LocationOn',
  'Home', 'Apartment', 'Business', 'Store', 'Storefront',
  'Restaurant', 'RestaurantMenu', 'LocalCafe', 'LocalBar', 'LocalPizza',
  'Hotel', 'LocalHospital', 'LocalPharmacy', 'LocalPolice',
  'School', 'LocalLibrary', 'Church', 'Stadium', 'FitnessCenter',
  'DirectionsCar', 'DirectionsBus', 'DirectionsBike', 'DirectionsBoat',
  'Flight', 'FlightTakeoff', 'FlightLand', 'Train', 'Tram',
  'Traffic', 'LocalParking', 'EvStation', 'LocalGasStation'
];

export const placeIcons: IconCategory = { id: 'place', name: 'Places', emoji: getIcon('Place'), icons: createIconItems(ICONS) };