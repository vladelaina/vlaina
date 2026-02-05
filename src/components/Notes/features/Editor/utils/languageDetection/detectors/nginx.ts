import type { LanguageDetector } from '../types';

export const detectNginx: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  // Simple single-line Nginx patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Nginx directive: server_name example.com;
    if (/^(server_name|listen|root|index|location|proxy_pass|return|rewrite)\s+/.test(trimmed)) {
      return 'nginx';
    }
  }

  if (/\b(const|let|var|function|export|import|class|interface)\s+/.test(first100Lines)) {
    return null;
  }

  if (/\b(fn\s+main|pub\s+fn|impl\s+\w+|use\s+std::)\b/.test(first100Lines)) {
    return null;
  }

  if (/\b(server|location|upstream|proxy_pass|listen|root|index|error_page|access_log|error_log)\b/.test(code)) {

    if (/server\s*\{|location\s+[^\{]*\{/.test(code)) {

      const nginxDirectives = (code.match(/\b(server|location|upstream|proxy_pass|listen|root|index|error_page|access_log|error_log|rewrite|return|try_files)\b/g) || []).length;
      if (nginxDirectives >= 2) {
        return 'nginx';
      }
    }
  }

  return null;
};
