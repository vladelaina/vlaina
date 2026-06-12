import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

export const TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS = 'editor-typora-button-group-has-selected';
export const TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS = 'editor-typora-table-figure-without-caption';
export const TYPORA_COMPATIBILITY_DOM_CLASS_SYNC_DELAY_MS = 160;

export const typoraCompatibilityDomClassesPluginKey = new PluginKey('typoraCompatibilityDomClasses');

const BUTTON_GROUP_SELECTOR = '.v-btn-group';
const SELECTED_BUTTON_SELECTOR = '.selected';
const TABLE_FIGURE_SELECTOR = 'figure.table-figure, .milkdown-table-block.table-figure';
const CAPTION_SELECTOR = '.v-caption';

type TyporaCompatibilityDomClassSyncResult = {
  buttonGroupsWithSelected: Set<HTMLElement>;
  tableFiguresWithoutCaption: Set<HTMLElement>;
};

function clearTyporaCompatibilityDomClasses(element: HTMLElement): void {
  element.classList.remove(
    TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS,
    TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS,
  );
}

function syncButtonGroupClasses(
  root: ParentNode,
  previousButtonGroupsWithSelected: Set<HTMLElement>,
): Set<HTMLElement> {
  const nextButtonGroupsWithSelected = new Set<HTMLElement>();
  const buttonGroups = Array.from(root.querySelectorAll<HTMLElement>(BUTTON_GROUP_SELECTOR));

  for (const buttonGroup of buttonGroups) {
    const hasSelectedButton = buttonGroup.querySelector(SELECTED_BUTTON_SELECTOR) !== null;
    buttonGroup.classList.toggle(TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS, hasSelectedButton);
    if (hasSelectedButton) {
      nextButtonGroupsWithSelected.add(buttonGroup);
    }
  }

  for (const buttonGroup of previousButtonGroupsWithSelected) {
    if (!nextButtonGroupsWithSelected.has(buttonGroup) && !buttonGroups.includes(buttonGroup)) {
      buttonGroup.classList.remove(TYPORA_BUTTON_GROUP_HAS_SELECTED_CLASS);
    }
  }

  return nextButtonGroupsWithSelected;
}

function syncTableFigureClasses(
  root: ParentNode,
  previousTableFiguresWithoutCaption: Set<HTMLElement>,
): Set<HTMLElement> {
  const nextTableFiguresWithoutCaption = new Set<HTMLElement>();
  const tableFigures = Array.from(root.querySelectorAll<HTMLElement>(TABLE_FIGURE_SELECTOR));

  for (const tableFigure of tableFigures) {
    const hasCaption = tableFigure.querySelector(CAPTION_SELECTOR) !== null;
    tableFigure.classList.toggle(TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS, !hasCaption);
    if (!hasCaption) {
      nextTableFiguresWithoutCaption.add(tableFigure);
    }
  }

  for (const tableFigure of previousTableFiguresWithoutCaption) {
    if (!nextTableFiguresWithoutCaption.has(tableFigure) && !tableFigures.includes(tableFigure)) {
      tableFigure.classList.remove(TYPORA_TABLE_FIGURE_WITHOUT_CAPTION_CLASS);
    }
  }

  return nextTableFiguresWithoutCaption;
}

export function syncTyporaCompatibilityDomClasses(
  root: ParentNode,
  previous: TyporaCompatibilityDomClassSyncResult = {
    buttonGroupsWithSelected: new Set<HTMLElement>(),
    tableFiguresWithoutCaption: new Set<HTMLElement>(),
  },
): TyporaCompatibilityDomClassSyncResult {
  return {
    buttonGroupsWithSelected: syncButtonGroupClasses(root, previous.buttonGroupsWithSelected),
    tableFiguresWithoutCaption: syncTableFigureClasses(root, previous.tableFiguresWithoutCaption),
  };
}

function shouldSyncTyporaCompatibilityDomClasses(prevState: EditorState | null | undefined, nextState: EditorState): boolean {
  return !prevState || !prevState.doc.eq(nextState.doc);
}

export const typoraCompatibilityDomClassesPlugin = $prose(() => {
  return new Plugin({
    key: typoraCompatibilityDomClassesPluginKey,
    view(editorView: EditorView) {
      let synced = syncTyporaCompatibilityDomClasses(editorView.dom);
      let pendingSyncTimeout: ReturnType<typeof setTimeout> | null = null;
      let destroyed = false;

      const clearPendingSync = () => {
        if (pendingSyncTimeout === null) {
          return;
        }
        clearTimeout(pendingSyncTimeout);
        pendingSyncTimeout = null;
      };

      const scheduleSync = (nextView: EditorView) => {
        clearPendingSync();
        pendingSyncTimeout = setTimeout(() => {
          pendingSyncTimeout = null;
          if (destroyed) {
            return;
          }
          synced = syncTyporaCompatibilityDomClasses(nextView.dom, synced);
        }, TYPORA_COMPATIBILITY_DOM_CLASS_SYNC_DELAY_MS);
      };

      return {
        update(nextView, prevState) {
          if (!shouldSyncTyporaCompatibilityDomClasses(prevState, nextView.state)) {
            return;
          }
          scheduleSync(nextView);
        },
        destroy() {
          destroyed = true;
          clearPendingSync();
          for (const element of synced.buttonGroupsWithSelected) {
            clearTyporaCompatibilityDomClasses(element);
          }
          for (const element of synced.tableFiguresWithoutCaption) {
            clearTyporaCompatibilityDomClasses(element);
          }
        },
      };
    },
  });
});
