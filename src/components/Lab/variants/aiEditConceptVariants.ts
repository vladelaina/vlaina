export type AiEditConceptFamily =
  | 'inline'
  | 'anchor'
  | 'bottom'
  | 'side'
  | 'document'
  | 'staged';

export type AiEditConceptTemplate =
  | 'inline-pill'
  | 'inline-card'
  | 'anchor-bubble'
  | 'anchor-stack'
  | 'bottom-bar'
  | 'bottom-sheet'
  | 'side-peek'
  | 'side-sheet'
  | 'document-block'
  | 'staged-flow';

export type AiEditConcept = {
  id: string;
  name: string;
  family: AiEditConceptFamily;
  template: AiEditConceptTemplate;
  description: string;
  rationale: string;
  controls: 'minimal' | 'balanced' | 'guided';
  preview: 'none' | 'inline' | 'split';
  editable: 'source' | 'result' | 'both';
};

const concept = (
  id: string,
  name: string,
  family: AiEditConceptFamily,
  template: AiEditConceptTemplate,
  controls: AiEditConcept['controls'],
  preview: AiEditConcept['preview'],
  editable: AiEditConcept['editable'],
  description: string,
  rationale: string
): AiEditConcept => ({
  id,
  name,
  family,
  template,
  controls,
  preview,
  editable,
  description,
  rationale,
});

export const AI_EDIT_CONCEPT_SELECTED_TEXT =
  'The release notes still feel uneven, and the key changes are easy to miss on a fast read.';

export const AI_EDIT_CONCEPT_RESULT_TEXT =
  'The release notes still feel uneven, and the key updates are easy to miss when someone scans quickly.';

export const AI_EDIT_CONCEPTS: AiEditConcept[] = [
  concept('inline-nudge-pill', 'Inline Nudge Pill', 'inline', 'inline-pill', 'minimal', 'none', 'source', 'A tiny capsule sits directly on the selection and asks one thing: what do you want to do?', 'Best when speed matters more than certainty.'),
  concept('inline-preset-pill', 'Inline Preset Pill', 'inline', 'inline-pill', 'minimal', 'none', 'source', 'The selection gets a preset-first chip like Translate or Polish, with no preview until the second step.', 'Good for frequent one-tap actions.'),
  concept('inline-dual-pill', 'Inline Dual Pill', 'inline', 'inline-pill', 'balanced', 'inline', 'both', 'A small pair of pills appears under the selection: one for action, one for compare.', 'Keeps the document feeling continuous.'),
  concept('between-lines-card', 'Between-Lines Card', 'inline', 'inline-card', 'balanced', 'split', 'both', 'A slim card inserts itself between paragraphs so the suggestion stays in the reading flow.', 'Useful when the user should not lose spatial context.'),
  concept('folded-inline-note', 'Folded Inline Note', 'inline', 'inline-card', 'guided', 'inline', 'result', 'The editor shows a folded note attached to the selected sentence with one expanded result area.', 'Feels calmer than a generic floating popup.'),
  concept('hover-pebble', 'Hover Pebble', 'anchor', 'anchor-bubble', 'minimal', 'none', 'source', 'A very small bubble hovers below the selection and only grows if the user asks for more.', 'Starts tiny, earns more space only when needed.'),
  concept('hover-ribbon', 'Hover Ribbon', 'anchor', 'anchor-bubble', 'balanced', 'inline', 'both', 'A single-row ribbon stays close to the selection and reveals the edited result beneath it.', 'A bridge between a toolbar and a review card.'),
  concept('anchor-stack', 'Anchor Stack', 'anchor', 'anchor-stack', 'guided', 'split', 'both', 'A two-layer stack shows action controls first and compare content second, still attached to the text.', 'More explicit without feeling like a detached window.'),
  concept('anchor-drop', 'Anchor Drop', 'anchor', 'anchor-stack', 'balanced', 'inline', 'result', 'The first click opens only presets; the second state drops a compact review surface in place.', 'Separates choosing from judging.'),
  concept('selection-tag-lens', 'Selection Tag Lens', 'anchor', 'anchor-bubble', 'minimal', 'split', 'result', 'The selection gets a tiny tag, and the actual review opens from that tag as a focused lens.', 'Makes the active region feel marked, not interrupted.'),
  concept('bottom-action-rail', 'Bottom Action Rail', 'bottom', 'bottom-bar', 'minimal', 'none', 'source', 'A narrow bottom rail appears with the selected snippet and a single preset entry point.', 'Stable position reduces pointer chasing.'),
  concept('bottom-command-dock', 'Bottom Command Dock', 'bottom', 'bottom-bar', 'balanced', 'inline', 'both', 'A docked bar holds prompt input, preset switcher, and a tiny in-place preview strip.', 'Feels familiar if the user already knows chat input.'),
  concept('bottom-two-step-sheet', 'Bottom Two-Step Sheet', 'bottom', 'bottom-sheet', 'guided', 'split', 'both', 'The first layer asks for intent, then expands upward into a review sheet with editable text.', 'A soft escalation path from light to heavy.'),
  concept('bottom-compare-tray', 'Bottom Compare Tray', 'bottom', 'bottom-sheet', 'balanced', 'split', 'result', 'The selected text stays on canvas while the bottom tray becomes a compact compare station.', 'Gives a stable result area without covering the document.'),
  concept('bottom-workbench', 'Bottom Workbench', 'bottom', 'bottom-sheet', 'guided', 'split', 'both', 'A mini workbench slides from the bottom with source, result, and prompt all editable.', 'Closer to a serious writing tool than a tooltip.'),
  concept('right-peek', 'Right Peek', 'side', 'side-peek', 'minimal', 'inline', 'result', 'A narrow peek card appears at the right edge, aligned with the selection height.', 'Document stays primary while AI sits nearby.'),
  concept('right-mini-inspector', 'Right Mini Inspector', 'side', 'side-sheet', 'balanced', 'split', 'both', 'A small inspector opens on the right with presets on top and editable compare below.', 'Feels like a native inspector rather than a popup.'),
  concept('right-review-drawer', 'Right Review Drawer', 'side', 'side-sheet', 'guided', 'split', 'both', 'A fuller drawer opens from the side only after the user commits to an AI action.', 'Better for longer outputs and multi-step edits.'),
  concept('side-diff-shelf', 'Side Diff Shelf', 'side', 'side-peek', 'balanced', 'split', 'result', 'A slim side shelf focuses only on diff and decisions, not prompts.', 'Useful when presets cover most of the intent.'),
  concept('margin-rail', 'Margin Rail', 'side', 'side-peek', 'minimal', 'none', 'source', 'The margin hosts tiny action rails next to the selected paragraph, similar to editorial comments.', 'Feels document-native and quiet.'),
  concept('inserted-review-block', 'Inserted Review Block', 'document', 'document-block', 'guided', 'split', 'both', 'The editor inserts a temporary AI block right under the selected paragraph.', 'No floating UI at all; everything happens in the document.'),
  concept('replace-card', 'Replace Card', 'document', 'document-block', 'balanced', 'inline', 'result', 'The original text dims and a review card appears in its place before commit.', 'Good when the user thinks in terms of replacement, not separate review.'),
  concept('paragraph-lens', 'Paragraph Lens', 'document', 'document-block', 'minimal', 'split', 'both', 'The selected paragraph expands into a compare lens with before and after stacked together.', 'Keeps one paragraph as the whole world for a moment.'),
  concept('margin-sticky-review', 'Margin Sticky Review', 'document', 'document-block', 'balanced', 'inline', 'result', 'A note-like review surface pins itself in the page margin with a leader back to the text.', 'More editorial than app-like.'),
  concept('commit-bar-under-text', 'Commit Bar Under Text', 'document', 'document-block', 'minimal', 'inline', 'both', 'Only a result strip and accept bar appear beneath the edited text, no full panel.', 'A very low-friction review path.'),
  concept('action-then-popover', 'Action Then Popover', 'staged', 'staged-flow', 'minimal', 'inline', 'result', 'Step one chooses a preset from the toolbar; step two opens a tiny compare popover.', 'Strong if preset actions are the main path.'),
  concept('action-then-bottom-sheet', 'Action Then Bottom Sheet', 'staged', 'staged-flow', 'guided', 'split', 'both', 'A first lightweight choice sends the user to a calmer bottom review sheet.', 'Lets the main toolbar stay simple.'),
  concept('press-hold-preview', 'Press-Hold Preview', 'staged', 'staged-flow', 'minimal', 'inline', 'result', 'Holding the action shows a temporary preview; releasing chooses whether to commit.', 'More experimental, but highly tactile.'),
  concept('flip-card-review', 'Flip Card Review', 'staged', 'staged-flow', 'balanced', 'split', 'both', 'A compact card flips between source and result before presenting final actions.', 'Makes comparison sequential instead of side by side.'),
  concept('timeline-checkpoint', 'Timeline Checkpoint', 'staged', 'staged-flow', 'guided', 'split', 'both', 'Each AI edit creates a small checkpoint card the user can accept, redo, or revisit.', 'Interesting if AI editing becomes iterative rather than one-shot.'),
];
