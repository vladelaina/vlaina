import type { LanguageDetector } from '../types';

export const detectDockerfile: LanguageDetector = (ctx) => {
  const { code, firstLine, first100Lines } = ctx;

  if (/\bfrom\s+\w+\s+import\b/.test(first100Lines) || /\bdef\s+\w+\s*\(/.test(first100Lines) || /\bclass\s+\w+/.test(first100Lines)) {
    return null;
  }

  const dockerInstructions = /^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\s+/im;

  if (dockerInstructions.test(firstLine)) {
    return 'dockerfile';
  }

  const matches = code.match(/^(FROM|RUN|CMD|COPY|ADD|WORKDIR|ENV|EXPOSE)\s+/gim);
  if (matches && matches.length >= 2) {
    return 'dockerfile';
  }

  return null;
};
