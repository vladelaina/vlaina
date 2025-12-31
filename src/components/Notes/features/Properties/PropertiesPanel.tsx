/**
 * PropertiesPanel - Display note metadata/properties
 * 
 * Modern block-editor style properties panel
 */

import { useMemo } from 'react';
import { IconInfoCircle, IconTextSize, IconHash, IconLink } from '@tabler/icons-react';

interface PropertiesPanelProps {
  content: string;
  path: string;
}

export function PropertiesPanel({ content, path }: PropertiesPanelProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const text = content || '';
    
    // Word count (split by whitespace)
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    // Character count
    const chars = text.length;
    
    // Line count
    const lines = text.split('\n').length;
    
    // Extract tags
    const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
    const tags: string[] = [];
    let tagMatch;
    while ((tagMatch = tagRegex.exec(text)) !== null) {
      if (!tags.includes(tagMatch[1].toLowerCase())) {
        tags.push(tagMatch[1].toLowerCase());
      }
    }
    
    // Extract wiki links
    const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const links: string[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(text)) !== null) {
      if (!links.includes(linkMatch[1])) {
        links.push(linkMatch[1]);
      }
    }
    
    return { words, chars, lines, tags, links };
  }, [content]);

  // Get note name from path
  const noteName = path.split('/').pop()?.replace('.md', '') || 'Untitled';
  const folderPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : 'Root';

  return (
    <div className="border-t border-[var(--neko-border)]">
      <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-medium text-[var(--neko-text-tertiary)] uppercase tracking-wider">
        <IconInfoCircle className="w-3.5 h-3.5" />
        Properties
      </div>
      
      <div className="px-3 pb-3 space-y-3">
        {/* File info */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--neko-text-tertiary)]">Name</span>
            <span className="text-[var(--neko-text-primary)] truncate max-w-[140px]" title={noteName}>
              {noteName}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--neko-text-tertiary)]">Folder</span>
            <span className="text-[var(--neko-text-primary)] truncate max-w-[140px]" title={folderPath}>
              {folderPath}
            </span>
          </div>
        </div>

        {/* Statistics */}
        <div className="pt-2 border-t border-[var(--neko-divider)] space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <IconTextSize className="w-3.5 h-3.5 text-[var(--neko-icon-secondary)]" />
            <span className="text-[var(--neko-text-tertiary)]">Words</span>
            <span className="ml-auto text-[var(--neko-text-primary)]">{stats.words.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3.5 h-3.5" />
            <span className="text-[var(--neko-text-tertiary)]">Characters</span>
            <span className="ml-auto text-[var(--neko-text-primary)]">{stats.chars.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3.5 h-3.5" />
            <span className="text-[var(--neko-text-tertiary)]">Lines</span>
            <span className="ml-auto text-[var(--neko-text-primary)]">{stats.lines.toLocaleString()}</span>
          </div>
        </div>

        {/* Tags */}
        {stats.tags.length > 0 && (
          <div className="pt-2 border-t border-[var(--neko-divider)]">
            <div className="flex items-center gap-2 text-xs mb-2">
              <IconHash className="w-3.5 h-3.5 text-[var(--neko-icon-secondary)]" />
              <span className="text-[var(--neko-text-tertiary)]">Tags ({stats.tags.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.tags.map(tag => (
                <span 
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] bg-[var(--neko-accent-light)] text-[var(--neko-accent)] rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {stats.links.length > 0 && (
          <div className="pt-2 border-t border-[var(--neko-divider)]">
            <div className="flex items-center gap-2 text-xs mb-2">
              <IconLink className="w-3.5 h-3.5 text-[var(--neko-icon-secondary)]" />
              <span className="text-[var(--neko-text-tertiary)]">Links ({stats.links.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.links.slice(0, 10).map(link => (
                <span 
                  key={link}
                  className="px-1.5 py-0.5 text-[10px] bg-[var(--neko-accent-light)] text-[var(--neko-accent)] rounded"
                >
                  [[{link}]]
                </span>
              ))}
              {stats.links.length > 10 && (
                <span className="px-1.5 py-0.5 text-[10px] text-[var(--neko-text-tertiary)]">
                  +{stats.links.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
