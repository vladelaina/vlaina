import { useMemo } from 'react';
import { AppViewModeSwitch } from '@/components/layout/sidebar/AppViewModeSwitch';
import {
  SidebarActionGroup,
  SidebarCapsulePanel,
  SidebarList,
  SidebarScrollArea,
  SidebarSearchField,
  SidebarSurface,
} from '@/components/layout/sidebar/SidebarPrimitives';
import {
  getSidebarIdleRowSurfaceClass,
  getSidebarSelectedRowSurfaceClass,
} from '@/components/layout/sidebar/sidebarLabelStyles';
import { useI18n } from '@/lib/i18n';
import { rankGraphNodes } from './model/graphFilters';
import { useNoteGraphModel } from './hooks/useNoteGraphModel';
import { useGraphUIStore, type GraphMode } from './store/useGraphUIStore';

const GRAPH_MODES: GraphMode[] = ['all', 'local'];
const MAX_GRAPH_SEARCH_RESULTS = 80;

export function GraphSidebar() {
  const { t } = useI18n();
  const searchQuery = useGraphUIStore((state) => state.searchQuery);
  const setMode = useGraphUIStore((state) => state.setMode);
  const setSearchQuery = useGraphUIStore((state) => state.setSearchQuery);
  const setSelectedPath = useGraphUIStore((state) => state.setSelectedPath);
  const { focusPath, fullGraph, mode } = useNoteGraphModel();
  const searchResults = useMemo(
    () => rankGraphNodes(fullGraph.nodes, searchQuery).slice(0, MAX_GRAPH_SEARCH_RESULTS),
    [fullGraph.nodes, searchQuery],
  );

  return (
    <SidebarSurface className="bg-[var(--vlaina-sidebar-notes-surface)] text-[var(--vlaina-sidebar-notes-text)]">
      <SidebarCapsulePanel>
        <SidebarActionGroup>
          <AppViewModeSwitch />
        </SidebarActionGroup>
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <div
            role="group"
            aria-label={t('app.viewGraph')}
            className="mx-2 mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[var(--vlaina-sidebar-notes-row-active)] p-1"
          >
            {GRAPH_MODES.map((graphMode) => {
              const active = graphMode === mode;
              return (
                <button
                  key={graphMode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(graphMode)}
                  className={[
                    'h-[var(--vlaina-size-32px)] cursor-pointer rounded-lg text-[length:var(--vlaina-font-13)] font-medium transition-colors',
                    active
                      ? 'bg-[var(--vlaina-sidebar-notes-surface)] text-[var(--vlaina-sidebar-row-selected-text)]'
                      : 'bg-transparent text-[var(--vlaina-sidebar-notes-text-soft)] hover:text-[var(--vlaina-sidebar-row-selected-text)]',
                  ].join(' ')}
                >
                  {t(graphMode === 'all' ? 'graph.modeAll' : 'graph.modeLocal')}
                </button>
              );
            })}
          </div>
          <SidebarSearchField
            value={searchQuery}
            aria-label={t('graph.searchPlaceholder')}
            placeholder={t('graph.searchPlaceholder')}
            closeLabel={t('graph.clearSearch')}
            onChange={(event) => setSearchQuery(event.target.value)}
            onClose={() => setSearchQuery('')}
          />
          <SidebarScrollArea className="min-h-0 flex-1 pt-0">
            {searchQuery.trim() ? (
              <SidebarList>
                {searchResults.map((node) => {
                  const selected = node.id === focusPath;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => setSelectedPath(node.id)}
                      className={[
                        'flex min-h-[var(--vlaina-size-36px)] w-full cursor-pointer flex-col justify-center px-2.5 py-1.5 text-left',
                        selected
                          ? getSidebarSelectedRowSurfaceClass('notes')
                          : getSidebarIdleRowSurfaceClass('notes'),
                      ].join(' ')}
                    >
                      <span className="w-full truncate text-[length:var(--vlaina-font-base)] font-medium">
                        {node.label}
                      </span>
                      <span className="w-full truncate text-[length:var(--vlaina-font-13)] text-[var(--vlaina-sidebar-notes-text-soft)]">
                        {node.id}
                      </span>
                    </button>
                  );
                })}
              </SidebarList>
            ) : (
              <p className="px-1 text-[length:var(--vlaina-font-13)] leading-relaxed text-[var(--vlaina-sidebar-notes-text-soft)]">
                {t('graph.sidebarHint')}
              </p>
            )}
          </SidebarScrollArea>
        </div>
      </SidebarCapsulePanel>
    </SidebarSurface>
  );
}
