/** Small, dependency-free identifier/hash helpers shared by the repos. */
import { createHash, randomBytes } from 'node:crypto';

/** 32-hex-char opaque local id. */
export const newId = (): string => randomBytes(16).toString('hex');

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input).digest('hex');
