/**
 * P2 slice 2: response security headers (blueprint 11/16: CSP, headers).
 *
 * Plain API responses only for now; the CSP is deliberately restrictive and
 * applies to every response including future HTML. No inline scripts, no
 * framing, no referrer leakage.
 */
import type { NextFunction, Request, Response } from 'express';

const CSP = "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.set('x-content-type-options', 'nosniff');
  res.set('x-frame-options', 'DENY');
  res.set('referrer-policy', 'no-referrer');
  res.set('content-security-policy', CSP);
  next();
}
