import { Icon } from '@/components/ui/icons';
import type { SearchResult } from '@/lib/ai/search';

interface CitationListProps {
  citations: SearchResult[];
}

export function CitationList({ citations }: CitationListProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5">
        <div className="flex items-center gap-1.5 mb-2">
            <Icon name="ai.language" className="text-gray-400" size="xs" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sources</span>
        </div>
        <div className="flex flex-col gap-1">
            {citations.slice(0, 4).map((citation, idx) => {
                const hostname = new URL(citation.url).hostname;
                return (
                    <a 
                        key={idx} 
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors group/source no-underline"
                    >
                        <div className="flex-shrink-0 w-4 h-4 bg-white rounded-sm overflow-hidden flex items-center justify-center border border-gray-100 dark:border-gray-700">
                            <img 
                                src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`} 
                                alt="" 
                                className="w-3 h-3 object-contain opacity-80"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate group-hover/source:text-blue-600 dark:group-hover/source:text-blue-400 transition-colors">
                                {citation.title}
                            </span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                                {idx + 1}
                            </span>
                        </div>
                    </a>
                );
            })}
        </div>
    </div>
  );
}
