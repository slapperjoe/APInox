import { useState, useCallback } from 'react';

export interface IgnoreRule {
  id: string;
  mode: 'host' | 'host+path';
  /** For host: just hostname. For host+path: hostname + pathname */
  pattern: string;
}

const STORAGE_KEY = 'apiprox-ignore-rules';

function load(): IgnoreRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function persist(rules: IgnoreRule[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rules)); } catch {}
}

export function matchesAnyIgnoreRule(url: string, rules: IgnoreRule[]): boolean {
  try {
    const u = new URL(url);
    return rules.some(r => {
      if (r.mode === 'host') return u.hostname === r.pattern;
      return (u.hostname + u.pathname).startsWith(r.pattern);
    });
  } catch { return false; }
}

export function ignorePatternFor(url: string, mode: 'host' | 'host+path'): string {
  try {
    const u = new URL(url);
    return mode === 'host' ? u.hostname : u.hostname + u.pathname;
  } catch { return url; }
}

export function useIgnoreList() {
  const [rules, setRules] = useState<IgnoreRule[]>(load);

  const addRule = useCallback((url: string, mode: 'host' | 'host+path') => {
    const pattern = ignorePatternFor(url, mode);
    setRules(prev => {
      if (prev.some(r => r.mode === mode && r.pattern === pattern)) return prev;
      const next = [...prev, { id: crypto.randomUUID(), mode, pattern }];
      persist(next);
      return next;
    });
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules(prev => {
      const next = prev.filter(r => r.id !== id);
      persist(next);
      return next;
    });
  }, []);

  return { rules, addRule, removeRule };
}
