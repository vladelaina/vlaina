import { SELECTOR_LEADING_BOUNDARY } from './shared';

const CHECKBOX_TRAILING_BOUNDARY = String.raw`(?=$|[\s>+~),.#\[:])`;

export function normalizeTaskCheckboxAliases(selector: string): string {
  const aliases: string[] = [];
  const stash = (value: string) => {
    const token = `__VLAINA_TASK_CHECKBOX_ALIAS_${aliases.length}__`;
    aliases.push(value);
    return token;
  };

  let result = selector
    .replace(
      /(^|[\s>+~,(])\.task-list-item\s+input(?:\[[^\]]+\])*:checked\s*\+\s*(p|span)(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string, contentElement: string) =>
        `${prefix}${stash(`li[data-item-type='task'][data-checked='true'] > ${contentElement}`)}`
    )
    .replace(
      /(^|[\s>+~,(])\.task-list-item\s+input(?:\[[^\]]+\])*\s*\+\s*(p|span)(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string, contentElement: string) =>
        `${prefix}${stash(`li[data-item-type='task'] > ${contentElement}`)}`
    )
    .replace(
      /(^|[\s>+~,(])\.task-list-item\s+input(?:\[[^\]]+\])*:checked(?:::after|:after)(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(":is(#write li[data-item-type='task'][data-checked='true'])::after")}`
    )
    .replace(
      /(^|[\s>+~,(])\.task-list-item\s+input(?:\[[^\]]+\])*(?:::after|:after)(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) => `${prefix}${stash(":is(#write li[data-item-type='task'])::after")}`
    )
    .replace(
      /(^|[\s>+~,(])\.task-list-item\s+input(?:\[[^\]]+\])*:checked(?:(?:::before|::after|:before|:after))?(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) =>
        `${prefix}${stash(":is(#write li[data-item-type='task'][data-checked='true'])::before")}`
    )
    .replace(
      /(^|[\s>+~,(])\.task-list-item\s+input(?:\[[^\]]+\])*(?:(?:::before|::after|:before|:after))?(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) => `${prefix}${stash(":is(#write li[data-item-type='task'])::before")}`
    )
    .replace(
      /(^|[\s>+~,(])\.task-list-item(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) => `${prefix}${stash("li[data-item-type='task']")}`
    )
    .replace(
      /(^|[\s>+~,(])li\s+label\.checkbox(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) => `${prefix}${stash("li[data-item-type='task']::before")}`
    )
    .replace(
      /(^|[\s>+~,(])((?:table\s+td\s+)?)label\.checkbox(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string, tablePrefix: string) =>
        `${prefix}${stash(`${tablePrefix}li[data-item-type='task']::before`)}`
    )
    .replace(
      /(^|[\s>+~,(])\.checkbox\s*>\s*svg(?=$|[\s>+~),.#\[:])/gi,
      (_match, prefix: string) => `${prefix}${stash("li[data-item-type='task']::before")}`
    )
    .replace(
      new RegExp(`${SELECTOR_LEADING_BOUNDARY}input((?:\\[[^\\]]+\\])*)\\:checked`
        + `(?:(?:::before|::after|:before|:after))?${CHECKBOX_TRAILING_BOUNDARY}`, 'gi'),
      (match: string, prefix: string, attrSelectors: string) => {
        const taskSelector = extractTaskDataSelector(attrSelectors);
        if (!taskSelector) return match;
        return `${prefix}${stash(renderTaskCheckboxSelector(taskSelector))}`;
      }
    )
    .replace(
      new RegExp(`${SELECTOR_LEADING_BOUNDARY}li((?:\\[[^\\]]+\\]|\\.[_a-zA-Z]+[_a-zA-Z0-9-]*)*)`
        + String.raw`\s*>\s*(?:p\s*>\s*)?input(?:\[[^\]]+\])*\:checked`
        + `(?:(?:::before|::after|:before|:after))?${CHECKBOX_TRAILING_BOUNDARY}`, 'gi'),
      (match: string, prefix: string, liSelectors: string) => {
        const taskSelector = extractTaskDataSelector(liSelectors);
        if (!taskSelector) return match;
        return `${prefix}${stash(renderTaskCheckboxSelector(taskSelector))}`;
      }
    );

  aliases.forEach((value, index) => {
    result = result.replaceAll(`__VLAINA_TASK_CHECKBOX_ALIAS_${index}__`, value);
  });

  return result;
}

function extractTaskDataSelector(selectors: string): string | null {
  const matches = Array.from(selectors.matchAll(
    /\[\s*data-task(?:\s*(?:[*^$|~]?=)\s*(?:"[^"]*"|'[^']*'|[^\]\s]+))?\s*\]/gi
  ));
  if (matches.length === 0) return null;
  return matches.map((match) => match[0]).join('');
}

function renderTaskCheckboxSelector(taskSelector: string): string {
  return `li[data-item-type='task']${taskSelector}[data-checked='true']::before`;
}
