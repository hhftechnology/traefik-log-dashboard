import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireAlertsMutationAuth } from './alerts-auth';

function createRequest(method: string, headers: Record<string, string | undefined> = {}): Request {
  return {
    method,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function createResponse(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
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

describe('requireAlertsMutationAuth GET routes', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.ALERTS_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ALERTS_API_KEY;
    } else {
      process.env.ALERTS_API_KEY = original;
    }
  });

  it('fails closed when ALERTS_API_KEY is unset', () => {
    delete process.env.ALERTS_API_KEY;
    const res = createResponse();
    const next = vi.fn() as NextFunction;
    requireAlertsMutationAuth(createRequest('GET'), res, next);
    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a GET without the key and accepts the matching key', () => {
    process.env.ALERTS_API_KEY = 'alerts-key';
    const denied = createResponse();
    const next = vi.fn() as NextFunction;
    requireAlertsMutationAuth(createRequest('GET'), denied, next);
    expect(denied.statusCode).toBe(401);

    const allowed = createResponse();
    requireAlertsMutationAuth(createRequest('GET', { 'x-alerts-api-key': 'alerts-key' }), allowed, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
