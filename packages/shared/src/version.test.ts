import { describe, expect, it } from 'vitest';
import {
  OFFLINE_PROJECT_VERSION,
  OFFLINE_STORAGE_KEY,
  PROJECT_FORMAT_MARKER,
  STUDIO_VERSION,
  SUPPORTED_OFFLINE_PROJECT_VERSIONS,
} from '../src/index.js';

describe('shared version contract', () => {
  it('exposes a non-empty studio version', () => {
    expect(STUDIO_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('keeps the offline project format marker stable (v1/v2 files depend on it)', () => {
    expect(PROJECT_FORMAT_MARKER).toBe('runtime-garden-social-studio');
  });

  it('keeps the offline localStorage key stable', () => {
    expect(OFFLINE_STORAGE_KEY).toBe('rg-social-studio-v1');
  });

  it('writes v2 files while still supporting v1', () => {
    expect(OFFLINE_PROJECT_VERSION).toBe(2);
    expect([...SUPPORTED_OFFLINE_PROJECT_VERSIONS]).toEqual([1, 2]);
  });
});
