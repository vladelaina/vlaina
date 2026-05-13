import type { LanguageDetector } from '../types';

export const detectDockerfile: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  // Exclude Elm (has module/import with exposing)
  if (/^module\s+[A-Z][\w.]*\s+exposing/m.test(first100Lines) ||
      /^import\s+[A-Z][\w.]*\s+exposing/m.test(first100Lines)) {
    return null;
  }

  if (/\bfrom\s+\w+\s+import\b/.test(first100Lines) || /\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/^(add|copy)\s+\w+\s*=/.test(firstLine.toLowerCase())) {
    return null;
  }

  const dockerInstructions = /^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\s+/im;

  if (dockerInstructions.test(firstLine)) {
    if (/^env\s+/i.test(firstLine)) {
      if (/^env\s+/.test(firstLine)) {
        return null;
      }

      const envBody = firstLine.trim().replace(/^ENV\s+/, '');
      const envAssignments = envBody.trim().split(/\s+/);
      const isKeyValueEnv = envAssignments.every((part) => /^[A-Za-z_]\w*=.+/.test(part));
      const isLegacyEnv = envAssignments.length === 2 && /^[A-Za-z_]\w*$/.test(envAssignments[0]);

      if (!isKeyValueEnv && !isLegacyEnv) {
        return null;
      }
    }

    if (/^(ADD|COPY)\s+/i.test(firstLine)) {
      if (!/\s+[./]/.test(firstLine)) {
        return null;
      }
    }
    return 'dockerfile';
  }

  const matches = code.match(/^(FROM|RUN|CMD|COPY|ADD|WORKDIR|ENV|EXPOSE)\s+/gim);
  if (matches && matches.length >= 2) {
    return 'dockerfile';
  }

  return null;
};
