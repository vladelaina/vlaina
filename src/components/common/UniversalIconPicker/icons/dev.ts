import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  'Code', 'Terminal', 'BugReport', 'DeveloperMode', 'DeviceHub', 
  'Memory', 'Storage', 'Dns', 'Router', 'Security', 
  'DataObject', 'DataArray', 'Html', 'Javascript', 'Css', 'Php',
  'IntegrationInstructions', 'Source', 'CodeOff', 'Webhook',
  'Android', 'Apple', 'Window', 'BrowserUpdated'
];

export const devIcons: IconCategory = { id: 'dev', name: 'Development', emoji: getIcon('Code'), icons: createIconItems(ICONS) };