import postcss from 'postcss';

export function isKeyframesRule(rule: postcss.Rule): boolean {
  let parent = rule.parent as postcss.AnyNode | undefined;
  while (parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) {
      return true;
    }
    parent = parent.parent as postcss.AnyNode | undefined;
  }
  return false;
}
