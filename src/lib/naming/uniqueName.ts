interface ResolveUniqueNameOptions {
  splitExtension?: boolean;
}

function splitExtension(name: string) {
  const match = name.match(/^(.*?)(\.[^.]*)$/);
  if (!match) {
    return { stem: name, extension: '' };
  }
  return { stem: match[1], extension: match[2] };
}

function splitNumericSuffix(name: string) {
  const match = name.match(/^(.*?)(?: (\d+))$/);
  if (!match || !match[1]) {
    return { stem: name, nextCounter: 1 };
  }
  return {
    stem: match[1],
    nextCounter: Number(match[2]) + 1,
  };
}

function buildCandidateName(name: string, counter: number, options: ResolveUniqueNameOptions) {
  if (options.splitExtension) {
    const { stem, extension } = splitExtension(name);
    const parsed = splitNumericSuffix(stem);
    return `${parsed.stem} ${counter}${extension}`;
  }

  const parsed = splitNumericSuffix(name);
  return `${parsed.stem} ${counter}`;
}

export async function resolveUniqueName(
  desiredName: string,
  exists: (candidateName: string) => Promise<boolean>,
  options: ResolveUniqueNameOptions = {}
) {
  if (!(await exists(desiredName))) {
    return desiredName;
  }

  const { stem } = options.splitExtension ? splitExtension(desiredName) : { stem: desiredName };
  const { nextCounter } = splitNumericSuffix(stem);

  let counter = nextCounter;
  while (true) {
    const candidate = buildCandidateName(desiredName, counter, options);
    if (!(await exists(candidate))) {
      return candidate;
    }
    counter += 1;
  }
}

export function resolveUniqueNameSync(
  desiredName: string,
  existingNames: readonly string[],
  options: ResolveUniqueNameOptions = {}
) {
  const normalizedExisting = new Set(existingNames.map((value) => value.toLocaleLowerCase()));
  if (!normalizedExisting.has(desiredName.toLocaleLowerCase())) {
    return desiredName;
  }

  const { stem } = options.splitExtension ? splitExtension(desiredName) : { stem: desiredName };
  const { nextCounter } = splitNumericSuffix(stem);

  let counter = nextCounter;
  while (true) {
    const candidate = buildCandidateName(desiredName, counter, options);
    if (!normalizedExisting.has(candidate.toLocaleLowerCase())) {
      return candidate;
    }
    counter += 1;
  }
}
