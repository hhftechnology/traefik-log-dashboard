import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { health } from './health';

describe('health', () => {
  it('returns ok without an agent id or dashboard token', () => {
    const body: unknown[] = [];
    const res = {
      json(payload: unknown) {
        body.push(payload);
        return res;
      },
    } as unknown as Response;

    health({} as Request, res);

    expect(body).toEqual([{ status: 'ok' }]);
  });
});
