const PREFIX = '[MathEditor]';

function describeNode(node: Node | EventTarget | null | undefined) {
  if (!(node instanceof Node)) {
    return null;
  }

  if (node instanceof HTMLElement) {
    return {
      nodeName: node.nodeName.toLowerCase(),
      className: node.className,
      dataType: node.getAttribute('data-type'),
      text: node.textContent?.slice(0, 80) ?? '',
    };
  }

  return {
    nodeName: node.nodeName.toLowerCase(),
    text: node.textContent?.slice(0, 80) ?? '',
  };
}

export function logMathEditorDebug(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`${PREFIX} ${message}`, details);
    return;
  }

  console.log(`${PREFIX} ${message}`);
}

export function describeMathDebugTarget(target: EventTarget | null | undefined) {
  return describeNode(target);
}

export function describeMathDebugElement(node: Node | null | undefined) {
  return describeNode(node);
}

logMathEditorDebug('module:loaded');
