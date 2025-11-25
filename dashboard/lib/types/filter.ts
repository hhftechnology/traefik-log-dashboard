// dashboard/lib/types/filter.ts

export interface FilterCondition {
  id: string;
  name: string;
  enabled: boolean;
  type: 'ip' | 'status' | 'user-agent' | 'custom' | 'country' | 'city';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'not_equals' | 'greater_than' | 'less_than';
  field: string;
  value: string;
  description?: string;
  mode?: 'exclude' | 'include';  // exclude = hide matching logs, include = show ONLY matching logs
}

export interface ProxySettings {
  enableCFHeaders: boolean;
  enableXForwardedFor: boolean;
  enableXRealIP: boolean;
  customHeaders: string[];
}

export interface FilterSettings {
  excludedIPs: string[];
  excludeUnknownIPs: boolean;
  excludePrivateIPs: boolean;
  excludeUnknownRoutersServices: boolean;
  proxySettings: ProxySettings;
  customConditions: FilterCondition[];
  excludeStatusCodes: number[];
  excludeBots: boolean;
  excludePaths: string[];
}

export const defaultFilterSettings: FilterSettings = {
  excludedIPs: [],
  excludeUnknownIPs: false,
  excludePrivateIPs: false,
  excludeUnknownRoutersServices: false,
  proxySettings: {
    enableCFHeaders: true,
    enableXForwardedFor: true,
    enableXRealIP: true,
    customHeaders: [],
  },
  customConditions: [],
  excludeStatusCodes: [],
  excludeBots: false,
  excludePaths: [],
};