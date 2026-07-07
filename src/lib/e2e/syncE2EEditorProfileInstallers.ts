import type { ActiveEditorDispatchProfile } from './syncE2EEditorProfileTypes';

function getPluginProfileKey(plugin: unknown, index: number): string {
  const candidate = plugin as {
    key?: unknown;
    spec?: {
      key?: {
        key?: unknown;
      } | unknown;
    };
  };
  const key = typeof candidate.key === 'string'
    ? candidate.key
    : typeof candidate.spec?.key === 'object' && candidate.spec.key && 'key' in candidate.spec.key && typeof candidate.spec.key.key === 'string'
      ? candidate.spec.key.key
      : typeof candidate.spec?.key === 'string'
        ? candidate.spec.key
        : `plugin-${index}`;
  return key.replace(/\$\d+$/u, '');
}

export function installPluginApplyProfilers(profile: ActiveEditorDispatchProfile): void {
  const fields = (profile.view.state as unknown as {
    config?: {
      fields?: readonly {
        apply?: unknown;
        name?: unknown;
      }[];
    };
  }).config?.fields;

  if (Array.isArray(fields)) {
    fields.forEach((field, index) => {
      if (typeof field.apply !== 'function') {
        return;
      }

      const originalApply = field.apply;
      const key = typeof field.name === 'string' ? field.name : `state-field-${index}`;
      profile.pluginOriginals.push({ originalApply, stateSpec: field });
      field.apply = function profiledStateFieldApply(this: unknown, ...args: unknown[]) {
        const startedAt = performance.now();
        try {
          return (originalApply as (...applyArgs: unknown[]) => unknown).apply(this, args);
        } finally {
          const samples = profile.pluginSamples.get(key) ?? [];
          samples.push(performance.now() - startedAt);
          profile.pluginSamples.set(key, samples);
        }
      };
    });
    return;
  }

  const plugins = profile.view.state.plugins as readonly unknown[];

  plugins.forEach((plugin, index) => {
    const stateSpec = (plugin as {
      spec?: {
        state?: {
          apply?: unknown;
        };
      };
    }).spec?.state;
    if (!stateSpec || typeof stateSpec.apply !== 'function') {
      return;
    }

    const originalApply = stateSpec.apply;
    const key = getPluginProfileKey(plugin, index);
    profile.pluginOriginals.push({ originalApply, stateSpec });
    stateSpec.apply = function profiledPluginApply(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return (originalApply as (...applyArgs: unknown[]) => unknown).apply(this, args);
      } finally {
        const samples = profile.pluginSamples.get(key) ?? [];
        samples.push(performance.now() - startedAt);
        profile.pluginSamples.set(key, samples);
      }
    };
  });
}

export function installDecorationPropProfilers(profile: ActiveEditorDispatchProfile): void {
  const plugins = profile.view.state.plugins as readonly unknown[];

  plugins.forEach((plugin, index) => {
    const props = (plugin as {
      props?: {
        decorations?: unknown;
      };
    }).props;
    if (!props || typeof props.decorations !== 'function') {
      return;
    }

    const originalDecorations = props.decorations;
    const key = getPluginProfileKey(plugin, index);
    profile.decorationOriginals.push({ originalDecorations, props });
    props.decorations = function profiledDecorations(this: unknown, ...args: unknown[]) {
      const startedAt = performance.now();
      try {
        return (originalDecorations as (...decorationsArgs: unknown[]) => unknown).apply(this, args);
      } finally {
        const samples = profile.decorationSamples.get(key) ?? [];
        samples.push(performance.now() - startedAt);
        profile.decorationSamples.set(key, samples);
      }
    };
  });
}
