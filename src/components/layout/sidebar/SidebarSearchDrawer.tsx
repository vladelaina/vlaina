import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '@/lib/utils';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import { SidebarSearchField } from './SidebarPrimitives';
import { useSidebarSearchControls } from './useSidebarSearchControls';

interface UseSidebarSearchDrawerStateOptions {
  isOpen: boolean;
  query: string;
  onOpen: () => void;
  onClose: () => void;
  scopeRef: RefObject<HTMLElement | null>;
}

interface SidebarSearchDrawerProps {
  isSearchOpen: boolean;
  shouldShowTopActions: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  hideSearch: () => void;
  canSubmit: boolean;
  onSubmit: () => void;
  placeholder: string;
  closeLabel: string;
  topActions?: ReactNode;
}

export function useSidebarSearchDrawerState({
  isOpen,
  query,
  onOpen,
  onClose,
  scopeRef,
}: UseSidebarSearchDrawerStateOptions) {
  const {
    inputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
  } = useSidebarSearchControls({
    isOpen,
    query,
    onOpen,
    onClose,
  });

  useHeldPageScroll(scrollRootRef, {
    scopeRef,
    ignoreEditableTargets: true,
  });

  const shouldShowSearchResults = isOpen && query.trim().length > 0;

  return {
    inputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
    shouldShowSearchResults,
  };
}

export function SidebarSearchDrawer({
  isSearchOpen,
  shouldShowTopActions,
  searchQuery,
  setSearchQuery,
  inputRef,
  hideSearch,
  canSubmit,
  onSubmit,
  placeholder,
  closeLabel,
  topActions,
}: SidebarSearchDrawerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hideSearch();
      return;
    }

    if (event.key === 'Enter' && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          isSearchOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <SidebarSearchField
            ref={inputRef}
            autoFocus={isSearchOpen}
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            onClose={hideSearch}
            closeLabel={closeLabel}
            className="pb-2"
          />
        </div>
      </div>

      {shouldShowTopActions ? topActions : null}
    </>
  );
}
