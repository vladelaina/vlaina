import {
  codeBlockNodeViewPlugin,
  collapsedCodeBlockSelectionGuardPlugin,
} from './codeBlockProsePlugins';
import { codeBlockIdAttr, codeBlockSchema } from './codeBlockSchema';

export { codeBlockSchema } from './codeBlockSchema';
export const codePlugin = [
  codeBlockIdAttr,
  codeBlockSchema,
  codeBlockNodeViewPlugin,
  collapsedCodeBlockSelectionGuardPlugin,
];
