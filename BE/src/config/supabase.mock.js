/**
 * In-memory Mock Supabase Client for local integration testing.
 * Path: src/config/supabase.mock.js
 */
import { roundToTwoDecimals } from '../utils/helpers.js';

// In-memory database store
export const db = {
  users: [],
  bill_rooms: [],
  receipts: [],
  receipt_items: [],
  item_assignments: [],
  participant_bills: []
};

// Reset database state between test runs
export function resetDb() {
  db.users = [];
  db.bill_rooms = [];
  db.receipts = [];
  db.receipt_items = [];
  db.item_assignments = [];
  db.participant_bills = [];
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.updateData = null;
    this.results = null;
    this.isDelete = false;
  }

  select(fields) {
    return this;
  }

  insert(data) {
    const records = Array.isArray(data) ? data : [data];
    const inserted = [];
    for (const r of records) {
      const newRecord = { ...r };
      
      // Auto-generate UUIDs if missing
      if (this.table === 'users' && !newRecord.user_id) {
        newRecord.user_id = 'user-' + Math.random().toString(36).substring(7);
      }
      if (this.table === 'bill_rooms' && !newRecord.room_id) {
        newRecord.room_id = 'room-' + Math.random().toString(36).substring(7);
      }
      if (this.table === 'receipts' && !newRecord.receipt_id) {
        newRecord.receipt_id = 'receipt-' + Math.random().toString(36).substring(7);
      }
      if (this.table === 'receipt_items' && !newRecord.item_id) {
        newRecord.item_id = 'item-' + Math.random().toString(36).substring(7);
      }
      if (this.table === 'participant_bills' && !newRecord.bill_id) {
        newRecord.bill_id = 'bill-' + Math.random().toString(36).substring(7);
      }
      if (this.table === 'item_assignments' && !newRecord.assignment_id) {
        newRecord.assignment_id = 'assign-' + Math.random().toString(36).substring(7);
      }

      if (!newRecord.created_at) newRecord.created_at = new Date().toISOString();
      if (!newRecord.updated_at) newRecord.updated_at = new Date().toISOString();

      db[this.table].push(newRecord);
      inserted.push(newRecord);
    }
    this.results = inserted;
    return this;
  }

  upsert(data, options = {}) {
    const records = Array.isArray(data) ? data : [data];
    const results = [];

    for (const r of records) {
      let existingIndex = -1;
      
      if (this.table === 'users') {
        existingIndex = db.users.findIndex(u => u.user_id === r.user_id);
      } else if (this.table === 'participant_bills') {
        existingIndex = db.participant_bills.findIndex(pb => pb.room_id === r.room_id && pb.user_id === r.user_id);
      }

      const recordToSave = { ...r };
      if (!recordToSave.updated_at) recordToSave.updated_at = new Date().toISOString();

      if (existingIndex > -1) {
        db[this.table][existingIndex] = { ...db[this.table][existingIndex], ...recordToSave };
        results.push(db[this.table][existingIndex]);
      } else {
        if (this.table === 'users' && !recordToSave.user_id) recordToSave.user_id = 'user-' + Math.random().toString(36).substring(7);
        if (this.table === 'participant_bills' && !recordToSave.bill_id) recordToSave.bill_id = 'bill-' + Math.random().toString(36).substring(7);
        if (!recordToSave.created_at) recordToSave.created_at = new Date().toISOString();

        db[this.table].push(recordToSave);
        results.push(recordToSave);
      }
    }
    this.results = results;
    return this;
  }

  update(data) {
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(col, val) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }

  lte(col, val) {
    this.filters.push({ type: 'lte', col, val });
    return this;
  }

  async execute() {
    let list = db[this.table] || [];

    // Apply filters
    for (const filter of this.filters) {
      if (filter.type === 'eq') {
        list = list.filter(item => item[filter.col] === filter.val);
      } else if (filter.type === 'lte') {
        list = list.filter(item => new Date(item[filter.col]) <= new Date(filter.val));
      }
    }

    if (this.isDelete) {
      const idsToRemove = new Set(list.map(item => item.item_id || item.bill_id || item.room_id || item.user_id || item.assignment_id || item.receipt_id));
      db[this.table] = db[this.table].filter(item => {
        const id = item.item_id || item.bill_id || item.room_id || item.user_id || item.assignment_id || item.receipt_id;
        return !idsToRemove.has(id);
      });
      return { data: list, error: null };
    }

    if (this.updateData) {
      list.forEach(item => {
        Object.assign(item, this.updateData, { updated_at: new Date().toISOString() });
      });
      return { data: list, error: null };
    }

    if (this.results) {
      return { data: this.results, error: null };
    }

    // Dynamic join hydration (e.g., users within participant_bills)
    const hydrated = list.map(item => {
      const cloned = { ...item };
      if (this.table === 'participant_bills') {
        const userObj = db.users.find(u => u.user_id === item.user_id);
        if (userObj) {
          cloned.users = { nickname: userObj.nickname };
        }
      }
      return cloned;
    });

    return { data: hydrated, error: null };
  }

  then(onfulfilled) {
    return this.execute().then(onfulfilled);
  }

  async maybeSingle() {
    const { data } = await this.execute();
    return { data: data.length > 0 ? data[0] : null, error: null };
  }

  async single() {
    const { data } = await this.execute();
    return { 
      data: data.length > 0 ? data[0] : null, 
      error: data.length > 0 ? null : new Error('Single record expected but not found') 
    };
  }
}

// Storage bucket mocking
class StorageBucket {
  constructor(bucketName) {
    this.bucketName = bucketName;
  }

  async upload(path, buffer, options = {}) {
    return { data: { path }, error: null };
  }

  getPublicUrl(path) {
    return {
      data: {
        publicUrl: `https://mock-supabase.co/storage/v1/object/public/${this.bucketName}/${path}`
      }
    };
  }
}

class StorageClient {
  constructor() {
    this.buckets = {};
  }

  async createBucket(name, options = {}) {
    this.buckets[name] = new StorageBucket(name);
    return { data: name, error: null };
  }

  from(name) {
    if (!this.buckets[name]) {
      this.buckets[name] = new StorageBucket(name);
    }
    return this.buckets[name];
  }
}

// Supabase RPC mock execution (JS ports of PL/pgSQL functions calculate_bill_room & assign_items_and_calculate)
export async function mockRpc(funcName, funcArgs) {
  const { p_room_id } = funcArgs;

  if (funcName === 'calculate_bill_room') {
    const room = db.bill_rooms.find(r => r.room_id === p_room_id);
    if (!room) return { error: new Error('Room not found') };

    const receipt = db.receipts.find(r => r.room_id === p_room_id);
    const pbs = db.participant_bills.filter(pb => pb.room_id === p_room_id);

    if (!receipt) {
      pbs.forEach(pb => { pb.amount_to_pay = 0.00; });
      return { error: null };
    }

    if (pbs.length === 0) return { error: null };

    let absorberId = room.host_id;

    if (room.split_mode === 'EQUAL') {
      const baseAmount = roundToTwoDecimals(receipt.total_amount / pbs.length);
      
      // Fallback if host left room
      if (!pbs.some(pb => pb.user_id === absorberId)) {
        absorberId = pbs[0].user_id;
      }

      let sumNonAbsorbers = 0.00;
      pbs.forEach(pb => {
        if (pb.user_id !== absorberId) {
          pb.amount_to_pay = baseAmount;
          sumNonAbsorbers += baseAmount;
        }
      });

      const hostPb = pbs.find(pb => pb.user_id === absorberId);
      if (hostPb) {
        hostPb.amount_to_pay = roundToTwoDecimals(receipt.total_amount - sumNonAbsorbers);
      }

    } else if (room.split_mode === 'ITEM_BASED') {
      const extraRate = receipt.subtotal > 0 ? (receipt.tax_amount + receipt.service_charge) / receipt.subtotal : 0.00;

      const items = db.receipt_items.filter(ri => ri.receipt_id === receipt.receipt_id);
      const assignments = db.item_assignments.filter(ia => items.some(ri => ri.item_id === ia.item_id));

      const hasHostSelection = assignments.some(ia => ia.user_id === room.host_id);
      if (hasHostSelection) {
        absorberId = room.host_id;
      } else {
        const lastSelection = assignments[assignments.length - 1];
        absorberId = lastSelection ? lastSelection.user_id : room.host_id;
      }

      if (assignments.length === 0) {
        pbs.forEach(pb => { pb.amount_to_pay = 0.00; });
        return { error: null };
      }

      // Count shares per item
      const itemShares = {};
      assignments.forEach(ia => {
        itemShares[ia.item_id] = (itemShares[ia.item_id] || 0) + 1;
      });

      let sumNonAbsorbers = 0.00;
      pbs.forEach(pb => {
        if (pb.user_id !== absorberId) {
          const userAssignments = assignments.filter(ia => ia.user_id === pb.user_id);
          if (userAssignments.length === 0) {
            pb.amount_to_pay = 0.00;
          } else {
            let userSubtotal = 0.00;
            userAssignments.forEach(ia => {
              const item = items.find(ri => ri.item_id === ia.item_id);
              if (item) {
                userSubtotal += (item.price * item.quantity) / itemShares[item.item_id];
              }
            });
            const userAmount = roundToTwoDecimals(userSubtotal * (1 + extraRate));
            pb.amount_to_pay = userAmount;
            sumNonAbsorbers += userAmount;
          }
        }
      });

      const hostPb = pbs.find(pb => pb.user_id === absorberId);
      if (hostPb) {
        hostPb.amount_to_pay = roundToTwoDecimals(receipt.total_amount - sumNonAbsorbers);
      }
    }

    return { error: null };
  }

  if (funcName === 'assign_items_and_calculate') {
    const { p_user_id, p_selected_item_ids } = funcArgs;

    // Fetch items for current room
    const items = db.receipt_items.filter(ri => {
      const rec = db.receipts.find(r => r.receipt_id === ri.receipt_id);
      return rec && rec.room_id === p_room_id;
    });

    // Delete user's old assignments for these items
    db.item_assignments = db.item_assignments.filter(ia => {
      const isUser = ia.user_id === p_user_id;
      const isRoomItem = items.some(ri => ri.item_id === ia.item_id);
      return !(isUser && isRoomItem);
    });

    // Re-assign selected items
    if (p_selected_item_ids && p_selected_item_ids.length > 0) {
      p_selected_item_ids.forEach(itemId => {
        db.item_assignments.push({
          assignment_id: 'assign-' + Math.random().toString(36).substring(7),
          item_id: itemId,
          user_id: p_user_id,
          created_at: new Date().toISOString()
        });
      });
    }

    return mockRpc('calculate_bill_room', { p_room_id });
  }

  return { error: new Error(`Function ${funcName} not supported in mock RPC`) };
}

// Mock Supabase Clients
export const mockSupabase = {
  auth: {
    getUser: async (token) => {
      // Mock auth middleware returning the token itself as user details
      // Allows us to easily authenticate dynamically generated user ids in tests
      if (token && token.startsWith('mock-token-')) {
        const id = token.replace('mock-token-', '');
        return { data: { user: { id, email: `${id}@test.com` } }, error: null };
      }
      return { data: { user: { id: 'mock-user-123', email: 'user@test.com' } }, error: null };
    }
  },
  from: (table) => new QueryBuilder(table),
  rpc: mockRpc,
  storage: new StorageClient()
};

export const mockSupabaseAdmin = mockSupabase;
