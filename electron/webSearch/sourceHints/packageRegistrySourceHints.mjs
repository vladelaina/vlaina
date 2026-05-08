const PACKAGE_REGISTRY_HINTS = [
  {
    pattern: /\bnpm\b\s+(@?[a-z0-9._/-]+)\s+\b(package|registry|official)\b/i,
    title(packageName) {
      return `${packageName} - npm`;
    },
    url(packageName) {
      return `https://www.npmjs.com/package/${packageName}`;
    },
    snippet(packageName) {
      return `Official npm package page for ${packageName}.`;
    },
  },
  {
    pattern: /\bpypi\b\s+([a-z0-9._-]+)\s+\b(package|project|official)\b/i,
    title(packageName) {
      return `${packageName} - PyPI`;
    },
    url(packageName) {
      return `https://pypi.org/project/${packageName}/`;
    },
    snippet(packageName) {
      return `Official PyPI project page for ${packageName}.`;
    },
  },
  {
    pattern: /\bcrates\.io\b\s+([a-z0-9_-]+)\s+\b(package|crate|official)\b/i,
    title(packageName) {
      return `${packageName} - crates.io`;
    },
    url(packageName) {
      return `https://crates.io/crates/${packageName}`;
    },
    snippet(packageName) {
      return `Official crates.io crate page for ${packageName}.`;
    },
  },
];

export function buildPackageRegistrySourceHints(query) {
  return PACKAGE_REGISTRY_HINTS.flatMap((hint) => {
    const match = String(query).match(hint.pattern);
    if (!match) return [];
    const packageName = match[1].replace(/\/$/, '');
    return {
      title: hint.title(packageName),
      url: hint.url(packageName),
      snippet: hint.snippet(packageName),
      publishedAt: null,
      source: 'local-web-search',
      thumbnail: null,
    };
  });
}
