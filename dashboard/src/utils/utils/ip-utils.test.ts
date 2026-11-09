import { describe, expect, it } from 'vitest';
import { extractIP, isPrivateIP } from './ip-utils';

describe('isPrivateIP', () => {
  it('marks only 172.16.0.0/12 as private in the 172 range', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('172.31.255.255')).toBe(true);
    expect(isPrivateIP('172.15.255.255')).toBe(false);
    expect(isPrivateIP('172.32.0.0')).toBe(false);
    expect(isPrivateIP('172.67.10.10')).toBe(false);
  });
});

describe('extractIP', () => {
  it('extracts IPv4 and IPv6 addresses from client address fields', () => {
    expect(extractIP('1.1.1.1:443')).toBe('1.1.1.1');
    expect(extractIP('[2001:4860:4860::8888]:443')).toBe('2001:4860:4860::8888');
    expect(extractIP('2001:4860:4860::8888')).toBe('2001:4860:4860::8888');
    expect(extractIP('2a02:1210:8c53:9c00:bd88:4066:d542:83bd')).toBe('2a02:1210:8c53:9c00:bd88:4066:d542:83bd');
    expect(extractIP('[2a02:1210:8c53:9c00:bd88:4066:d542:83bd]:2270')).toBe('2a02:1210:8c53:9c00:bd88:4066:d542:83bd');
  });
});
