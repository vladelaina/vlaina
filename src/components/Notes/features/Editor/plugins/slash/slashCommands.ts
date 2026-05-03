import type { Ctx } from '@milkdown/kit/ctx';
import {
  slashCommandDefinitions,
  type SlashCommandId,
} from './slashCommandDefinitions';

export type { SlashCommandId } from './slashCommandDefinitions';

export function applySlashCommand(ctx: Ctx, commandId: SlashCommandId) {
  const command = slashCommandDefinitions.find((definition) => definition.commandId === commandId);
  const result = command?.run(ctx);
  if (result instanceof Promise) {
    void result.catch((error) => {
      console.warn(`[SlashMenu] Command failed: ${commandId}`, error);
    });
  }
}
