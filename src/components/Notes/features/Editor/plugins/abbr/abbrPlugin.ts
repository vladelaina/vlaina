import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

export const abbrPluginKey = new PluginKey('abbr');

interface AbbrDefinition {
  abbr: string;
  fullText: string;
}

const ABBR_DEF_REGEX = /^\*\[([^\]]+)\]:\s*(.+)$/gm;

function extractAbbrDefinitions(doc: any): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];
  
  doc.descendants((node: any) => {
    if (node.isText) {
      const text = node.text || '';
      let match;
      
      ABBR_DEF_REGEX.lastIndex = 0;
      while ((match = ABBR_DEF_REGEX.exec(text)) !== null) {
        definitions.push({
          abbr: match[1],
          fullText: match[2].trim()
        });
      }
    }
  });
  
  return definitions;
}

function findAbbrUsages(doc: any, definitions: AbbrDefinition[]): { start: number; end: number; fullText: string }[] {
  const usages: { start: number; end: number; fullText: string }[] = [];
  
  if (definitions.length === 0) return usages;
  
  const abbrMap = new Map(definitions.map(d => [d.abbr, d.fullText]));
  const escapedAbbrs = definitions.map(d => escapeRegex(d.abbr));
  const pattern = new RegExp('\\b(' + escapedAbbrs.join('|') + ')\\b', 'g');
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || '';
      let match;
      
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const abbr = match[1];
        const fullText = abbrMap.get(abbr);
        
        if (fullText) {
          usages.push({
            start: pos + match.index,
            end: pos + match.index + abbr.length,
            fullText
          });
        }
      }
    }
  });
  
  return usages;
}

function escapeRegex(str: string): string {
  let result = '';
  for (const char of str) {
    if ('.*+?^${}()|[]\\'.includes(char)) {
      result += '\\' + char;
    } else {
      result += char;
    }
  }
  return result;
}

function createAbbrDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  const definitions = extractAbbrDefinitions(doc);
  const usages = findAbbrUsages(doc, definitions);
  
  for (const usage of usages) {
    decorations.push(
      Decoration.inline(usage.start, usage.end, {
        nodeName: 'abbr',
        title: usage.fullText,
        class: 'abbr'
      })
    );
  }
  
  return DecorationSet.create(doc, decorations);
}

export const abbrPlugin = $prose(() => {
  return new Plugin({
    key: abbrPluginKey,
    state: {
      init(_, { doc }) {
        return createAbbrDecorations(doc);
      },
      apply(tr, old) {
        if (tr.docChanged) {
          if (tr.steps.length <= 2) {
            return old.map(tr.mapping, tr.doc);
          }
          return createAbbrDecorations(tr.doc);
        }
        return old;
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
});