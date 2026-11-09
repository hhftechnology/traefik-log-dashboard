import { afterEach, describe, expect, it } from 'vitest';
import { isAllowedProxyTarget } from './proxy-allowlist';

const original = process.env.DASHBOARD_PROXY_ALLOWLIST;

afterEach(() => {
  if (original === undefined) {
    delete process.env.DASHBOARD_PROXY_ALLOWLIST;
  } else {
    process.env.DASHBOARD_PROXY_ALLOWLIST = original;
  }
});

describe('isAllowedProxyTarget', () => {
  it('fails closed when the allowlist is empty', () => {
    delete process.env.DASHBOARD_PROXY_ALLOWLIST;
    expect(isAllowedProxyTarget('http://traefik-agent:5000')).toBe(false);
  });

  it('matches a hostname or host:port entry and rejects other ports', () => {
    process.env.DASHBOARD_PROXY_ALLOWLIST = 'traefik-agent:5000, logs.example.com';
    expect(isAllowedProxyTarget('http://traefik-agent:5000')).toBe(true);
    expect(isAllowedProxyTarget('traefik-agent:5000')).toBe(true);
    expect(isAllowedProxyTarget('http://traefik-agent:5001')).toBe(false);
    expect(isAllowedProxyTarget('https://logs.example.com/api')).toBe(true);
    expect(isAllowedProxyTarget('http://traefik-agent.evil.com:5000')).toBe(false);
  });

  it('matches a full origin only for the same scheme and host', () => {
    process.env.DASHBOARD_PROXY_ALLOWLIST = 'https://logs.example.com:8443';
    expect(isAllowedProxyTarget('https://logs.example.com:8443/api/logs')).toBe(true);
    expect(isAllowedProxyTarget('http://logs.example.com:8443')).toBe(false);
  });

  it('rejects userinfo and non-http schemes', () => {
    process.env.DASHBOARD_PROXY_ALLOWLIST = 'traefik-agent:5000';
    expect(isAllowedProxyTarget('http://user:pass@traefik-agent:5000')).toBe(false);
    expect(isAllowedProxyTarget('file:///etc/passwd')).toBe(false);
  });
});
