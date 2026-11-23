/* 存档：带版本号的 JSON。只在月与月之间存档；跨月的行军、围城、交涉都在局势里。 */
import type { GameState } from './types';

export const SAVE_FORMAT = 'nanming-save';
export const SAVE_VERSION = 1;

export interface SaveFile { format: string; version: number; savedAt: string; label: string; state: GameState }

/** set 返回是否写入成功 */
export interface KV { get(key: string): string | null; set(key: string, value: string): boolean; remove(key: string): void; keys(): string[] }

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { get: k => m.get(k) ?? null, set: (k, v) => { m.set(k, v); return true; }, remove: k => void m.delete(k), keys: () => [...m.keys()] };
}

/** 浏览器本地存储；不可用时退回内存（隐私模式等） */
export function browserKV(prefix = 'nanming:'): KV {
  try {
    const ls = globalThis.localStorage;
    const probe = prefix + '__probe';
    ls.setItem(probe, '1'); ls.removeItem(probe);
    return {
      get: k => { try { return ls.getItem(prefix + k); } catch { return null; } },
      set: (k, v) => { try { ls.setItem(prefix + k, v); return true; } catch { return false; /* 存储已满或被禁用 */ } },
      remove: k => { try { ls.removeItem(prefix + k); } catch { /* ignore */ } },
      keys: () => { try { return Object.keys(ls).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length)); } catch { return []; } },
    };
  } catch { return memoryKV(); }
}

export function serialize(state: GameState, label: string): string {
  const f: SaveFile = { format: SAVE_FORMAT, version: SAVE_VERSION, savedAt: new Date().toISOString(), label, state };
  return JSON.stringify(f);
}

export function deserialize(text: string): SaveFile {
  let f: SaveFile;
  try { f = JSON.parse(text); } catch { throw new Error('存档不是有效的 JSON'); }
  if (!f || f.format !== SAVE_FORMAT) throw new Error('不是南明的存档');
  if (f.version > SAVE_VERSION) throw new Error('存档来自更新的版本');
  if (!f.state || typeof f.state.turn !== 'number' || !f.state.cities) throw new Error('存档内容不完整');
  return f;
}

export const SLOTS = ['auto', '1', '2', '3'] as const;
export type Slot = typeof SLOTS[number];

/** 写入失败返回 false；浏览器存储写入是原子的，失败时旧档原样保留 */
export function saveTo(kv: KV, slot: Slot, state: GameState, label: string): boolean { return kv.set('slot:' + slot, serialize(state, label)); }
export function loadFrom(kv: KV, slot: Slot): SaveFile | null {
  const t = kv.get('slot:' + slot);
  if (!t) return null;
  try { return deserialize(t); } catch { return null; }
}
