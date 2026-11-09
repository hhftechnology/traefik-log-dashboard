import { describe, expect, it } from 'vitest';
import { omitBlankToken } from './agents';

describe('omitBlankToken', () => {
  it('drops an empty token so an edit does not clear a stored secret', () => {
    expect(omitBlankToken({ name: 'Primary', token: '' })).toEqual({ name: 'Primary' });
  });

  it('keeps a replacement token', () => {
    expect(omitBlankToken({ token: 'next-token' })).toEqual({ token: 'next-token' });
  });
});
