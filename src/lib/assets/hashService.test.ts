/**
 * Hash Service Tests
 * Property-based tests for content hashing
 * 
 * Feature: asset-library
 * Property 5: Hash Format Correctness
 * Validates: Requirements 3.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeBufferHash } from './hashService';

describe('hashService', () => {
  describe('Property 5: Hash Format Correctness', () => {
    it('hash is exactly 16 lowercase hex characters for any input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 0, maxLength: 10000 }),
          async (data) => {
            const hash = await computeBufferHash(data);
            
            // Must be exactly 16 characters
            expect(hash.length).toBe(16);
            
            // Must be lowercase hex only
            expect(hash).toMatch(/^[0-9a-f]{16}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same content produces same hash (deterministic)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          async (data) => {
            const hash1 = await computeBufferHash(data);
            const hash2 = await computeBufferHash(data);
            
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different content produces different hash (collision resistance)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 500 }),
          fc.uint8Array({ minLength: 1, maxLength: 500 }),
          async (data1, data2) => {
            // Skip if arrays are equal
            if (data1.length === data2.length && 
                data1.every((v, i) => v === data2[i])) {
              return true;
            }
            
            const hash1 = await computeBufferHash(data1);
            const hash2 = await computeBufferHash(data2);
            
            // Different content should produce different hashes
            // (with extremely high probability for SHA-256)
            expect(hash1).not.toBe(hash2);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Known value tests', () => {
    it('empty buffer produces consistent hash', async () => {
      const hash = await computeBufferHash(new Uint8Array([]));
      expect(hash.length).toBe(16);
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
      // SHA-256 of empty string is known
      expect(hash).toBe('e3b0c44298fc1c14');
    });

    it('known content produces expected hash prefix', async () => {
      const content = new TextEncoder().encode('hello world');
      const hash = await computeBufferHash(content);
      expect(hash.length).toBe(16);
      // SHA-256 of "hello world" starts with b94d27b9...
      expect(hash).toBe('b94d27b9934d3e08');
    });
  });
});
