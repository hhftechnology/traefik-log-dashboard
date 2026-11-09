import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { readPresentedDashboardToken, requireDashboardAuth, tokensMatch } from './auth';

function createRequest(headers: Record<string, string | undefined>): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function createResponse(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('tokensMatch', () => {
  it('accepts an exact match and rejects a different length', () => {
    expect(tokensMatch('dashboard-token', 'dashboard-token')).toBe(true);
    expect(tokensMatch('dashboard-token', 'dashboard-token-x')).toBe(false);
    expect(tokensMatch('dashboard-token', 'other-token')).toBe(false);
  });
});

describe('readPresentedDashboardToken', () => {
  it('prefers X-Dashboard-Token and otherwise reads a Bearer token', () => {
    expect(readPresentedDashboardToken(createRequest({ 'x-dashboard-token': ' from-header ' }))).toBe('from-header');
    expect(readPresentedDashboardToken(createRequest({ authorization: 'Bearer from-bearer' }))).toBe('from-bearer');
    expect(readPresentedDashboardToken(createRequest({ authorization: 'Basic abc' }))).toBe('');
  });
});

describe('requireDashboardAuth', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.DASHBOARD_API_TOKEN;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DASHBOARD_API_TOKEN;
    } else {
      process.env.DASHBOARD_API_TOKEN = original;
    }
  });

  it('fails closed when DASHBOARD_API_TOKEN is unset', () => {
    delete process.env.DASHBOARD_API_TOKEN;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireDashboardAuth(createRequest({}), res, next);

    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong token', () => {
    process.env.DASHBOARD_API_TOKEN = 'expected-token';
    const missing = createResponse();
    const next = vi.fn() as NextFunction;
    requireDashboardAuth(createRequest({}), missing, next);
    expect(missing.statusCode).toBe(401);

    const wrong = createResponse();
    requireDashboardAuth(createRequest({ authorization: 'Bearer wrong-token' }), wrong, next);
    expect(wrong.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a matching bearer token', () => {
    process.env.DASHBOARD_API_TOKEN = 'expected-token';
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    requireDashboardAuth(createRequest({ authorization: 'Bearer expected-token' }), res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
