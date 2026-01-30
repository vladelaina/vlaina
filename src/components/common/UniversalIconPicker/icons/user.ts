import { IconCategory, createIconItems, getIcon } from './types';

const ICONS = [
  'Person', 'PersonOutline', 'PersonAdd', 'PersonRemove',
  'People', 'PeopleOutline', 'Group', 'Groups',
  'AccountCircle', 'AccountBox', 'Badge', 'ContactPage',
  'Face', 'Face2', 'Face3', 'Face4', 'Face5', 'Face6',
  'SupportAgent', 'ManageAccounts', 'SupervisorAccount', 'AdminPanelSettings',
  'SentimentSatisfied', 'SentimentDissatisfied', 'SentimentVerySatisfied', 'SentimentVeryDissatisfied',
  'Mood', 'MoodBad', 'ThumbUp', 'ThumbDown', 'Handshake',
  'Accessibility', 'Accessible', 'ChildCare', 'Elderly'
];

export const userIcons: IconCategory = { id: 'user', name: 'User & Social', emoji: getIcon('Person'), icons: createIconItems(ICONS) };