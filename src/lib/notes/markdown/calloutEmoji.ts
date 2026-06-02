const LEADING_FLAG_EMOJI_RE = /^(\p{Regional_Indicator}{2})\s*/u;
const LEADING_KEYCAP_EMOJI_RE = /^([#*0-9]\uFE0F?\u20E3)\s*/u;
const LEADING_PICTOGRAPHIC_EMOJI_RE =
  /^((?:\p{Emoji_Presentation}[\uFE0E\uFE0F]?|\p{Extended_Pictographic}\uFE0F)(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Emoji_Presentation}[\uFE0E\uFE0F]?|\p{Extended_Pictographic}\uFE0F)(?:\p{Emoji_Modifier})?)*)\s*/u;

export function consumeLeadingCalloutEmoji(text: string): { icon: string; rest: string } | null {
  const match =
    LEADING_FLAG_EMOJI_RE.exec(text) ||
    LEADING_KEYCAP_EMOJI_RE.exec(text) ||
    LEADING_PICTOGRAPHIC_EMOJI_RE.exec(text);

  const icon = match?.[1];
  if (!icon) {
    return null;
  }

  return {
    icon,
    rest: text.slice(match[0].length),
  };
}
