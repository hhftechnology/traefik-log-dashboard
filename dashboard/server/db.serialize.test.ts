import { describe, expect, it } from 'vitest';
import { serializeAgent, type DBAgent } from './db';

function row(token: string): DBAgent {
  return {
    id: 'agent-001',
    name: 'Primary',
    url: 'http://traefik-agent:5000',
    configured_url: 'traefik-agent:5000',
    token,
    source: 'env',
    location: 'on-site',
    number: 1,
    status: 'online',
    description: null,
    tags: null,
    last_seen: null,
  };
}

describe('serializeAgent', () => {
  it('does not return the stored agent token', () => {
    const serialized = serializeAgent(row('super-secret-token'));
    expect(serialized).not.toHaveProperty('token');
    expect(JSON.stringify(serialized)).not.toContain('super-secret-token');
    expect(serialized.tokenSet).toBe(true);
  });

  it('reports when no token is stored', () => {
    expect(serializeAgent(row('')).tokenSet).toBe(false);
  });
});
