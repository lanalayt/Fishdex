import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const rivers = sqliteTable('rivers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  region: text('region'),
  state: text('state'),
  notes: text('notes'),
  groupId: text('group_id'),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncedAt: text('synced_at'),
  isDeleted: integer('is_deleted').default(0),
});

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  riverId: text('river_id').notNull().references(() => rivers.id),
  groupId: text('group_id'),
  userId: text('user_id'),
  date: text('date').notNull(),
  locationOnRiver: text('location_on_river'),
  weather: text('weather'),
  temperature: text('temperature'),
  flowCfs: integer('flow_cfs'),
  leaderLength: text('leader_length'),
  tippetSize: text('tippet_size'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncedAt: text('synced_at'),
  isDeleted: integer('is_deleted').default(0),
});

export const catches = sqliteTable('catches', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id),
  flyPattern: text('fly_pattern').notNull(),
  flySize: text('fly_size'),
  flyColor: text('fly_color'),
  heat: text('heat'), // 'hot' | 'mild' | 'cold' — how well the fly produced
  count: integer('count').default(0), // legacy: fish count on older trips
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncedAt: text('synced_at'),
  isDeleted: integer('is_deleted').default(0),
});

export const flyShopAdvice = sqliteTable('fly_shop_advice', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id),
  shopName: text('shop_name').notNull(),
  advice: text('advice'),
  recommendedFlies: text('recommended_flies'), // JSON string array
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  syncedAt: text('synced_at'),
  isDeleted: integer('is_deleted').default(0),
});

export const syncQueue = sqliteTable('sync_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  operation: text('operation').notNull(), // INSERT, UPDATE, DELETE
  payload: text('payload').notNull(), // JSON
  createdAt: text('created_at').notNull(),
  attempts: integer('attempts').default(0),
  lastError: text('last_error'),
});

// Type helpers
export type River = typeof rivers.$inferSelect;
export type NewRiver = typeof rivers.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Catch = typeof catches.$inferSelect;
export type NewCatch = typeof catches.$inferInsert;
export type FlyShopAdvice = typeof flyShopAdvice.$inferSelect;
export type NewFlyShopAdvice = typeof flyShopAdvice.$inferInsert;
