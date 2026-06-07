export const SELECTOR_LEADING_BOUNDARY = String.raw`(^|[\s>+~,(])`;
export const SELECTOR_TRAILING_BOUNDARY = String.raw`(?=$|[\s>+~):.#\[])`;

export function isNegativeFunctionAliasMatch(
  selector: string,
  matchOffset: number,
  prefix: string
): boolean {
  const aliasStartOffset = matchOffset + prefix.length;
  return /:not\(\s*$/i.test(selector.slice(Math.max(0, aliasStartOffset - 16), aliasStartOffset));
}
