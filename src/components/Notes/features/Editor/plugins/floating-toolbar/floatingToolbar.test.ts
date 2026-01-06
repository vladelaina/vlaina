// Floating Toolbar Property-Based Tests
// Feature: floating-toolbar
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  computeToolbarVisibility,
  computeToolbarPlacement,
  isValidUrl,
  isMarkActive,
} from './utils';

describe('Floating Toolbar Properties', () => {
  /**
   * Property 1: Toolbar Visibility Based on Selection State
   * For any editor state, the floating toolbar SHALL be visible if and only if
   * there is a non-empty text selection (from !== to).
   * **Validates: Requirements 1.5, 2.5**
   */
  describe('Property 1: Toolbar Visibility Based on Selection State', () => {
    it('should show toolbar iff selection is non-empty', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (from, to) => {
            const hasSelection = from !== to;
            const toolbarVisible = computeToolbarVisibility(from, to);
            return toolbarVisible === hasSelection;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should hide toolbar when selection is collapsed (from === to)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (pos) => {
            const toolbarVisible = computeToolbarVisibility(pos, pos);
            return toolbarVisible === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show toolbar when selection exists (from !== to)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 1, max: 100 }),
          (from, offset) => {
            const to = from + offset;
            const toolbarVisible = computeToolbarVisibility(from, to);
            return toolbarVisible === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Toolbar Positioning Logic
   * For any text selection with a bounding rectangle, if the selection's top edge
   * is within 60px of the viewport top, the toolbar SHALL be placed below the selection;
   * otherwise, it SHALL be placed above the selection.
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Toolbar Positioning Logic', () => {
    it('should place toolbar below when selection is near viewport top', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 59 }),
          (selectionTop) => {
            const placement = computeToolbarPlacement(selectionTop, 0);
            return placement === 'bottom';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place toolbar above when selection is far from viewport top', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60, max: 2000 }),
          (selectionTop) => {
            const placement = computeToolbarPlacement(selectionTop, 0);
            return placement === 'top';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly handle viewport offset', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2000 }),
          fc.integer({ min: 0, max: 500 }),
          (selectionTop, viewportTop) => {
            const distanceFromTop = selectionTop - viewportTop;
            const expectedPlacement = distanceFromTop < 60 ? 'bottom' : 'top';
            const actualPlacement = computeToolbarPlacement(selectionTop, viewportTop);
            return actualPlacement === expectedPlacement;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: URL Validation
   * For any string input to the link editor, if the string does not match a valid URL pattern
   * (http://, https://, mailto:, or relative path starting with /), the system SHALL indicate
   * a validation error. Valid URLs SHALL be accepted without error.
   * **Validates: Requirements 4.6**
   */
  describe('Property 7: URL Validation', () => {
    it('should accept valid http/https URLs', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            return isValidUrl(url) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid mailto URLs', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            const mailtoUrl = `mailto:${email}`;
            return isValidUrl(mailtoUrl) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid relative paths', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z0-9\-_\/]+$/).filter(s => s.length > 0 && s.length <= 50),
          (path) => {
            const relativePath = `/${path}`;
            return isValidUrl(relativePath) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty strings', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('   ')).toBe(false);
    });

    it('should reject invalid URL formats', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
            !s.startsWith('http://') && 
            !s.startsWith('https://') && 
            !s.startsWith('mailto:') && 
            !s.startsWith('/')
          ),
          (invalidUrl) => {
            return isValidUrl(invalidUrl) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: State Reflection Accuracy (partial - mark detection)
   * For any text selection, the toolbar's active button states SHALL accurately
   * reflect the marks present in the selection.
   * **Validates: Requirements 2.3, 3.4, 4.3, 5.5, 7.5**
   */
  describe('Property 4: State Reflection Accuracy (Mark Detection)', () => {
    it('should correctly identify active marks', () => {
      const markTypes = ['strong', 'em', 'underline', 'strike', 'code', 'highlight', 'link'];
      
      fc.assert(
        fc.property(
          fc.subarray(markTypes, { minLength: 0, maxLength: markTypes.length }),
          (activeMarkNames) => {
            const activeMarks = new Set(activeMarkNames);
            
            // Check each mark type
            return markTypes.every(markName => {
              const expected = activeMarkNames.includes(markName);
              const actual = isMarkActive(activeMarks, markName);
              return expected === actual;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for marks not in the set', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (randomMarkName) => {
            const emptyMarks = new Set<string>();
            return isMarkActive(emptyMarks, randomMarkName) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
