/**
 * PropertiesPanel - Display note metadata/properties
 * 
 * Obsidian-style properties panel showing:
 * - Created date
 * - Modified date
 * - Word count
 * - Character count
 * - Tags in note
 * - Links in note
 */

import { useMemo } from 'react';
import { InfoIcon, TextAaIcon, HashIcon, LinkIcon } from '@phosphor-icons/react';

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
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="px-3 py-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        <InfoIcon className="size-3.5" weight="bold" />
        Properties
      </div>
      
      <div className="px-3 pb-3 space-y-3">
        {/* File info */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 dark:text-zinc-500">Name</span>
            <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]" title={noteName}>
              {noteName}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 dark:text-zinc-500">Folder</span>
            <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]" title={folderPath}>
              {folderPath}
            </span>
          </div>
        </div>

        {/* Statistics */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <TextAaIcon className="size-3.5 text-zinc-400" weight="bold" />
            <span className="text-zinc-400 dark:text-zinc-500">Words</span>
            <span className="ml-auto text-zinc-700 dark:text-zinc-300">{stats.words.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="size-3.5" />
            <span className="text-zinc-400 dark:text-zinc-500">Characters</span>
            <span className="ml-auto text-zinc-700 dark:text-zinc-300">{stats.chars.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="size-3.5" />
            <span className="text-zinc-400 dark:text-zinc-500">Lines</span>
            <span className="ml-auto text-zinc-700 dark:text-zinc-300">{stats.lines.toLocaleString()}</span>
          </div>
        </div>

        {/* Tags */}
        {stats.tags.length > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs mb-2">
              <HashIcon className="size-3.5 text-zinc-400" weight="bold" />
              <span className="text-zinc-400 dark:text-zinc-500">Tags ({stats.tags.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.tags.map(tag => (
                <span 
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {stats.links.length > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs mb-2">
              <LinkIcon className="size-3.5 text-zinc-400" weight="bold" />
              <span className="text-zinc-400 dark:text-zinc-500">Links ({stats.links.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.links.slice(0, 10).map(link => (
                <span 
                  key={link}
                  className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                >
                  [[{link}]]
                </span>
              ))}
              {stats.links.length > 10 && (
                <span className="px-1.5 py-0.5 text-[10px] text-zinc-400">
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
