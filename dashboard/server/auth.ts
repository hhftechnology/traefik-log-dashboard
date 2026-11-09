import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function tokensMatch(presented: string, expected: string): boolean {
  const presentedBuffer = Buffer.from(presented);
  const expectedBuffer = Buffer.from(expected);
  const length = Math.max(presentedBuffer.length, expectedBuffer.length, 1);
  const paddedPresented = Buffer.alloc(length);
  const paddedExpected = Buffer.alloc(length);
  presentedBuffer.copy(paddedPresented);
  expectedBuffer.copy(paddedExpected);
  return crypto.timingSafeEqual(paddedPresented, paddedExpected) && presentedBuffer.length === expectedBuffer.length;
}

export function readPresentedDashboardToken(req: Request): string {
  const header = req.header('x-dashboard-token');
  if (header && header.trim()) {
    return header.trim();
  }

  const authorization = req.header('authorization') || '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return match ? match[1] : '';
}

export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  const configured = process.env.DASHBOARD_API_TOKEN?.trim() || '';
  if (!configured) {
    res.status(503).json({
      error: 'Dashboard API token is not configured',
      message: 'Set DASHBOARD_API_TOKEN before using management routes.',
    });
    return;
  }

  const presented = readPresentedDashboardToken(req);
  if (!presented || !tokensMatch(presented, configured)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Provide the dashboard API token via Authorization: Bearer or X-Dashboard-Token.',
    });
    return;
  }

  next();
}
