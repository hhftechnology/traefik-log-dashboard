import { NextFunction, Request, Response } from 'express';
import { tokensMatch } from './auth';

export function presentedAlertsKey(req: Request): string {
  return req.header('x-alerts-api-key')
    || req.header('x-api-key')
    || req.header('authorization')?.replace(/^Bearer\s+/i, '')
    || '';
}

export function requireAlertsMutationAuth(req: Request, res: Response, next: NextFunction): void {
  const alertsApiKey = process.env.ALERTS_API_KEY?.trim() || '';
  const presented = presentedAlertsKey(req).trim();

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!alertsApiKey) {
      res.status(503).json({ error: 'Alerts API key is not configured' });
      return;
    }
    if (!presented || !tokensMatch(presented, alertsApiKey)) {
      res.status(401).json({ error: 'alerts API key is required for this operation' });
      return;
    }
    next();
    return;
  }

  if (!alertsApiKey) {
    next();
    return;
  }

  if (!presented || !tokensMatch(presented, alertsApiKey)) {
    res.status(401).json({ error: 'alerts API key is required for this operation' });
    return;
  }

  next();
}
