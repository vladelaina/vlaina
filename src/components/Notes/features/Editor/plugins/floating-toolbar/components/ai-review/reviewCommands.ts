import { AI_REVIEW_COMMANDS, AI_REVIEW_TONE_COMMANDS } from '../../ai/constants';

export function resolveReviewCommand(value: string): {
  id: string;
  instruction: string;
  toneId: string | null;
} | null {
  const command = AI_REVIEW_COMMANDS.find((item) => item.id === value);
  if (command) {
    return {
      id: command.id,
      instruction: command.instruction,
      toneId: null,
    };
  }

  const tone = AI_REVIEW_TONE_COMMANDS.find((item) => item.id === value);
  if (!tone) {
    return null;
  }

  return {
    id: tone.id,
    instruction: tone.instruction,
    toneId: tone.id,
  };
}
