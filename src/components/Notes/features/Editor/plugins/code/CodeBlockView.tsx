import React, { useState, useMemo } from 'react';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { MdCheck, MdContentCopy, MdMoreHoriz, MdAutoAwesome, MdSearch, MdCode, MdShare } from 'react-icons/md';
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '../../utils/shiki';
import { guessLanguage } from '../../utils/languageGuesser';
import { getLanguageLogo } from '../../utils/languageLogos';
import { cn, iconButtonStyles } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CodeBlockViewProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export const CodeBlockView: React.FC<CodeBlockViewProps> = ({ node, view, getPos }) => {
  const language = node.attrs.language || 'text';
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const langInfo = SUPPORTED_LANGUAGES.find(l => l.id === language);
  const displayName = langInfo ? langInfo.name : language;

  const filteredLanguages = useMemo(() => {
    setActiveIndex(0); // Reset index when search term changes
    if (!searchTerm) return SUPPORTED_LANGUAGES;
    const term = searchTerm.toLowerCase();
    return SUPPORTED_LANGUAGES.filter(l => 
        l.name.toLowerCase().includes(term) || 
        l.id.toLowerCase().includes(term) ||
        l.aliases?.some(a => a.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const updateLanguage = (newLang: string) => {
      console.log('=== updateLanguage called ===');
      console.log('Input language:', newLang);
      
      const pos = getPos();
      console.log('Node position:', pos);
      
      if (pos === undefined) {
        console.log('ERROR: Position is undefined, cannot update');
        return;
      }
      
      const normalized = normalizeLanguage(newLang) || newLang;
      console.log('Normalized language:', normalized);
      console.log('Current node attrs:', node.attrs);

      view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              language: normalized
          })
      );
      
      console.log('Transaction dispatched');
      setSearchTerm(''); // Clear search on select
      console.log('=== updateLanguage finished ===');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // We want to stop propagation for most keys to avoid triggering editor shortcuts
    // but handle specific navigation keys ourselves.
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(prev => Math.min(prev + 1, filteredLanguages.length - 1));
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const selected = filteredLanguages[activeIndex];
        if (selected) {
            updateLanguage(selected.id);
            setIsLangMenuOpen(false);
        }
    } else {
        e.stopPropagation();
    }
  };

  const handleAutoDetect = () => {
    console.log('=== Auto Detect Started ===');
    const code = node.textContent;
    console.log('Code content:', code?.slice(0, 200));
    console.log('Code length:', code?.length);
    
    const guessed = guessLanguage(code);
    console.log('Guessed language:', guessed);
    
    if (guessed) {
        console.log('Calling updateLanguage with:', guessed);
        updateLanguage(guessed);
        // Auto-close the dropdown after successful detection
        setIsLangMenuOpen(false);
    } else {
        console.log('No language detected - guessLanguage returned null');
    }
    console.log('=== Auto Detect Finished ===');
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const code = node.textContent;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Placeholder for share functionality
    console.log('Share code block:', node.textContent);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (scrollRef.current) {
        const activeItem = scrollRef.current.children[activeIndex] as HTMLElement;
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }
  }, [activeIndex]);

  const headerRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    // Traverse up: CodeBlockView div -> headerDOM -> code-block-container
    const container = headerRef.current?.parentElement?.parentElement;
    if (container) {
       // When collapsed, we only want to show the header (approx 35-40px)
       // The container has the border and background.
       if (isCollapsed) {
           container.classList.add('collapsed');
           container.style.height = '40px'; // Match the header's h-[40px]
           container.style.overflow = 'hidden';
       } else {
           container.classList.remove('collapsed');
           container.style.height = '';
           container.style.overflow = '';
       }
    }
  }, [isCollapsed]);

  return (
    <div 
      ref={headerRef} 
      onClick={toggleCollapse}
      className="flex items-center justify-between px-4 py-2 bg-white dark:bg-[#1e1e1e] select-none rounded-t-xl transition-all h-[40px] cursor-pointer"
    >
        <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu 
            open={isLangMenuOpen} 
            onOpenChange={(open) => {
                setIsLangMenuOpen(open);
                if (!open) setSearchTerm('');
            }}
          >
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 group/lang cursor-pointer transition-colors select-none">
                <div className="size-[18px] flex items-center justify-center flex-shrink-0 overflow-hidden rounded-none">
                  {getLanguageLogo(language) ? (
                    <img 
                      src={getLanguageLogo(language)?.url} 
                      className={cn("w-full h-full object-contain block rounded-none", getLanguageLogo(language)?.className)} 
                      alt={displayName}
                      style={{ borderRadius: '0' }}
                    />
                  ) : (
                    <MdCode className="size-[18px] text-zinc-400 group-hover/lang:text-zinc-900 dark:group-hover/lang:text-zinc-100 transition-colors" />
                  )}
                </div>
                <span className="text-sm font-medium text-zinc-500 group-hover/lang:text-zinc-900 dark:group-hover/lang:text-zinc-100 transition-colors">
                  {displayName}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px] p-0 overflow-hidden flex flex-col border border-gray-200 dark:border-zinc-800 shadow-xl rounded-xl">
              {/* Search Bar & Auto-Detect Group */}
              <div className="p-2 bg-gray-50/50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
                <div className="relative flex items-center">
                  <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-[18px] text-gray-400" />
                  <input
                    autoFocus
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg pl-8 pr-10 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Search language..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAutoDetect();
                    }}
                    title="Auto Detect Language"
                    className="absolute right-1.5 p-1 rounded-md text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <MdAutoAwesome className="size-[18px]" />
                  </button>
                </div>
              </div>

              {/* Languages List */}
              <div ref={scrollRef} className="max-h-[240px] overflow-y-auto p-1 neko-scrollbar">
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map((lang, index) => {
                    const logo = getLanguageLogo(lang.id);
                    return (
                      <DropdownMenuItem 
                        key={lang.id} 
                        onSelect={() => updateLanguage(lang.id)}
                        className={cn(
                          "text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2",
                          index === activeIndex ? "bg-gray-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" : "text-gray-600 dark:text-zinc-400",
                          language === lang.id && index !== activeIndex && "text-blue-600 dark:text-blue-400 font-bold"
                        )}
                      >
                        {logo ? (
                          <img src={logo.url} className={cn("size-4 object-contain flex-shrink-0", logo.className)} alt={lang.name} />
                        ) : (
                          <div className="size-4 flex items-center justify-center flex-shrink-0">
                            <MdCode className="size-3.5 opacity-40" />
                          </div>
                        )}
                        <span>{lang.name}</span>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
                    No languages found
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center gap-1">
            <button 
                onClick={handleCopy}
                className={cn("flex items-center justify-center size-8 rounded-full p-0 leading-none", iconButtonStyles, copied && "text-green-500 hover:text-green-600")}
            >
                {copied ? <MdCheck className="size-[18px] block" /> : <MdContentCopy className="size-[18px] block" />}
            </button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button 
                        onClick={(e) => e.stopPropagation()}
                        className={cn("flex items-center justify-center size-8 rounded-full p-0 leading-none", iconButtonStyles)}
                    >
                        <MdMoreHoriz className="size-[18px] block" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                     <DropdownMenuItem onClick={handleShare} className="cursor-pointer text-xs">
                        <MdShare className="mr-2 size-[18px]" />
                        <span>Share</span>
                     </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
  );
};