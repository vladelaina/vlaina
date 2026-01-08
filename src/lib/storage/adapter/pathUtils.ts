/**
 * Cross-platform Path Utilities
 * 
 * Provides path manipulation functions that work consistently
 * across Tauri (native file system) and Web (virtual file system)
 */

/**
 * Check if running in Tauri environment
 * Inline implementation to avoid circular dependency
 */
function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false;
  // Check for Tauri 2.x first, then fallback to 1.x
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Detect path separator based on platform and path content
 */
export function getPathSeparator(path?: string): string {
  if (!path) return '/';
  
  // Check for Windows drive letter pattern first (e.g., C:\, D:\)
  if (/^[a-zA-Z]:[\\/]/.test(path)) return '\\';
  
  // If path contains backslash, likely Windows
  if (path.includes('\\')) return '\\';
  
  // Default to forward slash (Unix/Web/macOS/Linux)
  return '/';
}

/**
 * Normalize path to use consistent separators
 * Web always uses forward slashes
 * Tauri preserves the original separator style
 */
export function normalizePath(path: string, forceForwardSlash = false): string {
  if (forceForwardSlash || !isTauriEnv()) {
    return path.replace(/\\/g, '/');
  }
  return path;
}

/**
 * Join path segments
 * On web platform, always use forward slashes
 * On Tauri, preserve the original separator style
 */
export function joinPath(...segments: string[]): string {
  const filtered = segments.filter(Boolean);
  if (filtered.length === 0) return '';
  
  // On web platform, always use forward slashes
  const sep = isTauriEnv() ? getPathSeparator(filtered[0]) : '/';
  
  return filtered
    .map((segment, index) => {
      // Remove leading separator except for first segment
      if (index > 0) {
        segment = segment.replace(/^[/\\]+/, '');
      }
      // Remove trailing separator except for last segment
      if (index < filtered.length - 1) {
        segment = segment.replace(/[/\\]+$/, '');
      }
      return segment;
    })
    .join(sep);
}

/**
 * Get parent directory path
 */
export function getParentPath(path: string): string | null {
  const normalized = normalizePath(path, true);
  const parts = normalized.split('/').filter(Boolean);
  
  if (parts.length <= 1) return null;
  
  parts.pop();
  const parent = parts.join('/');
  
  // Restore original separator style
  if (path.includes('\\')) {
    return parent.replace(/\//g, '\\');
  }
  
  return parent || '/';
}

/**
 * Get file/folder name from path
 */
export function getBaseName(path: string): string {
  const normalized = normalizePath(path, true);
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

/**
 * Get file extension (without dot)
 */
export function getExtension(path: string): string {
  const name = getBaseName(path);
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return name.slice(lastDot + 1);
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  // Windows absolute path (C:\, D:\, etc.)
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  // Unix absolute path
  if (path.startsWith('/')) return true;
  return false;
}

/**
 * Make path relative to base path
 */
export function relativePath(from: string, to: string): string {
  const fromNorm = normalizePath(from, true).replace(/\/$/, '');
  const toNorm = normalizePath(to, true);
  
  if (toNorm.startsWith(fromNorm + '/')) {
    return toNorm.slice(fromNorm.length + 1);
  }
  
  return toNorm;
}
