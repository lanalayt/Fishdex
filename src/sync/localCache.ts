import { Platform } from 'react-native';
import { supabase } from '../supabase/client';
import { SUPABASE_ENABLED } from '../supabase/config';
import { getIsOnline } from '../utils/connectivity';

const sb = () => supabase as any;
const isWeb = Platform.OS === 'web';

// On native, get the SQLite database
let db: any = null;
let expo: any = null;
if (!isWeb) {
  try {
    const client = require('../db/client');
    db = client.db;
    expo = client.expo;
  } catch {}
}

// ── Sync queue (stored in SQLite on native, memory on web) ──

interface QueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: string;
}

let memoryQueue: QueueItem[] = [];

function generateQueueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function addToSyncQueue(table: string, operation: 'insert' | 'update' | 'delete', data: any) {
  const item: QueueItem = {
    id: generateQueueId(),
    table,
    operation,
    data,
    timestamp: new Date().toISOString(),
  };
  memoryQueue.push(item);

  // Also save to SQLite on native
  if (!isWeb && expo) {
    try {
      expo.execSync(
        `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at) VALUES ('${table}', '${data.id || ''}', '${operation}', '${JSON.stringify(data).replace(/'/g, "''")}', '${item.timestamp}')`
      );
    } catch {}
  }
}

// ── Push queued items to Supabase ──

export async function pushSyncQueue(): Promise<number> {
  if (!SUPABASE_ENABLED || !supabase || !getIsOnline()) return 0;

  let pushed = 0;
  const queue = [...memoryQueue];

  for (const item of queue) {
    try {
      if (item.operation === 'insert') {
        const { error } = await sb().from(item.table).upsert(item.data);
        if (!error) {
          memoryQueue = memoryQueue.filter(q => q.id !== item.id);
          pushed++;
        }
      } else if (item.operation === 'update') {
        const { id: recordId, ...updateData } = item.data;
        const { error } = await sb().from(item.table).update(updateData).eq('id', recordId);
        if (!error) {
          memoryQueue = memoryQueue.filter(q => q.id !== item.id);
          pushed++;
        }
      } else if (item.operation === 'delete') {
        const { error } = await sb().from(item.table).update({ is_deleted: true }).eq('id', item.data.id);
        if (!error) {
          memoryQueue = memoryQueue.filter(q => q.id !== item.id);
          pushed++;
        }
      }
    } catch {}
  }

  // Clear SQLite queue for pushed items
  if (!isWeb && expo && pushed > 0) {
    try { expo.execSync('DELETE FROM sync_queue WHERE 1=1'); } catch {}
  }

  return pushed;
}

export function getSyncQueueLength(): number {
  return memoryQueue.length;
}

// ── Read with fallback ──

export async function readFromSupabaseOrLocal(
  table: string,
  query?: { column: string; value: any }[],
  orderBy?: string,
  ascending?: boolean,
): Promise<any[]> {
  // Try Supabase first if online
  if (SUPABASE_ENABLED && supabase && getIsOnline()) {
    try {
      let q = sb().from(table).select('*').eq('is_deleted', false);
      if (query) {
        for (const cond of query) {
          q = q.eq(cond.column, cond.value);
        }
      }
      if (orderBy) q = q.order(orderBy, { ascending: ascending ?? false });
      const { data, error } = await q;
      if (!error && data) {
        // Cache to SQLite on native
        if (!isWeb) cacheToLocal(table, data);
        return data;
      }
    } catch {}
  }

  // Fallback to local SQLite
  if (!isWeb && db) {
    try {
      return readFromLocal(table, query, orderBy);
    } catch {}
  }

  return [];
}

// ── Local SQLite operations (native only) ──

function cacheToLocal(table: string, rows: any[]) {
  if (isWeb || !expo) return;

  try {
    // Create cache table if not exists
    const cols = rows[0] ? Object.keys(rows[0]).map(k => `${toSnake(k)} TEXT`).join(', ') : 'id TEXT PRIMARY KEY';
    expo.execSync(`CREATE TABLE IF NOT EXISTS cache_${table} (${cols})`);

    // Clear and re-insert
    expo.execSync(`DELETE FROM cache_${table}`);
    for (const row of rows) {
      const keys = Object.keys(row);
      const vals = keys.map(k => {
        const v = row[k];
        if (v === null || v === undefined) return 'NULL';
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      expo.execSync(`INSERT OR REPLACE INTO cache_${table} (${keys.map(toSnake).join(',')}) VALUES (${vals.join(',')})`);
    }
  } catch {}
}

function readFromLocal(table: string, query?: { column: string; value: any }[], orderBy?: string): any[] {
  if (isWeb || !expo) return [];

  try {
    let sql = `SELECT * FROM cache_${table} WHERE 1=1`;
    if (query) {
      for (const cond of query) {
        sql += ` AND ${toSnake(cond.column)} = '${String(cond.value).replace(/'/g, "''")}'`;
      }
    }
    if (orderBy) sql += ` ORDER BY ${toSnake(orderBy)} DESC`;

    const result = expo.getAllSync(sql);
    return result || [];
  } catch {
    return [];
  }
}

function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// ── Write with offline queue ──

export async function writeToSupabase(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: any,
): Promise<boolean> {
  // Always try Supabase first if online
  if (SUPABASE_ENABLED && supabase && getIsOnline()) {
    try {
      if (operation === 'insert') {
        const { error } = await sb().from(table).insert(data);
        if (!error) return true;
      } else if (operation === 'update') {
        const { id: recordId, ...updateData } = data;
        const { error } = await sb().from(table).update(updateData).eq('id', recordId);
        if (!error) return true;
      } else if (operation === 'delete') {
        const { error } = await sb().from(table).update({ is_deleted: true }).eq('id', data.id);
        if (!error) return true;
      }
    } catch {}
  }

  // Offline or failed — queue for later
  addToSyncQueue(table, operation, data);
  return false;
}
