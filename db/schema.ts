import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, integer, jsonb, check } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  // admin plugin; a null role means "user"
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Songs owners add to the /music television; the three starters stay in content/site.ts.
export const song = pgTable("song", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  note: text("note").notNull(), // "" when none
  colour: text("colour").notNull(), // a Swatch key, checked in lib/songs.ts
  video: text("video").notNull(), // 11-char YouTube id
  position: integer("position").notNull(), // play order after the built-ins
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ask the console's model tier (lib/ask-llm.ts): one row per rate-limit bucket, "ip:<hmac>:<UTC hour>" or
// "day:<UTC date>", counting requests let through to it. Rows older than two days are swept by the route.
export const askUsage = pgTable("ask_usage", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Anonymous ink stays pending until the owner reviews it. The public API selects explicit fields.
export const guestbookEntry = pgTable("guestbook_entry", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  note: text("note").notNull().default(""),
  v: integer("v").notNull(),
  strokes: jsonb("strokes").notNull(),
  durationMs: integer("duration_ms").notNull(),
  pointCount: integer("point_count").notNull(),
  byteCount: integer("byte_count").notNull(),
  status: text("status").notNull().default("pending"),
  tilt: integer("tilt").notNull(),
  tape: integer("tape").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, precision: 6 }),
  reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
}, (table) => [
  index("guestbook_public_idx").on(table.status, table.createdAt.desc(), table.id.desc()),
  check("guestbook_status_check", sql`${table.status} in ('pending', 'approved', 'rejected')`),
  check("guestbook_tilt_check", sql`${table.tilt} between -4 and 4`),
  check("guestbook_tape_check", sql`${table.tape} between 0 and 3`),
  check("guestbook_v_check", sql`${table.v} = 1`),
]);

export const guestbookUsage = pgTable("guestbook_usage", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [check("guestbook_usage_count_check", sql`${table.count} >= 0`)]);

// Bottle suggestions are never public before an owner/admin's explicit approval.
export const bottleSuggestion = pgTable("bottle_suggestion", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  note: text("note").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  submitterHmac: text("submitter_hmac").notNull(),
  createdAt: timestamp("created_at", {withTimezone:true,precision:6}).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {withTimezone:true,precision:6}).defaultNow().notNull(),
}, table => [
  index("bottle_review_idx").on(table.status,table.id),
  check("bottle_status_check", sql`${table.status} in ('pending','approved','rejected')`),
  check("bottle_kind_check", sql`${table.kind} in ('site','toy','art')`),
  check("bottle_text_check", sql`char_length(${table.title}) between 1 and 80 and char_length(${table.note}) between 1 and 80 and char_length(${table.url}) <= 2048`),
]);
export const bottleUsage = pgTable("bottle_usage", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull(),
  updatedAt: timestamp("updated_at", {withTimezone:true,precision:6}).defaultNow().notNull(),
}, table => [check("bottle_usage_count_check",sql`${table.count} between 0 and 5`)]);

// Observations remain private until explicitly approved by the owner.
export const inkblotAnswer = pgTable("inkblot_answer", {
  id: text("id").primaryKey(),
  blotKey: text("blot_key").notNull(),
  name: text("name").notNull().default(""),
  note: text("note").notNull(),
  status: text("status").notNull().default("pending"),
  tilt: integer("tilt").notNull(),
  hand: integer("hand").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, precision: 6 }),
  reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
}, (table) => [
  index("inkblot_public_idx").on(table.blotKey, table.status, table.createdAt.desc(), table.id.desc()),
  check("inkblot_status_check", sql`${table.status} in ('pending', 'approved', 'rejected')`),
  check("inkblot_tilt_check", sql`${table.tilt} between -4 and 4`),
  check("inkblot_hand_check", sql`${table.hand} between 0 and 2`),
  check("inkblot_text_check", sql`char_length(${table.name}) <= 24 and char_length(${table.note}) between 1 and 80`),
]);

export const inkblotUsage = pgTable("inkblot_usage", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [check("inkblot_usage_count_check", sql`${table.count} >= 0`)]);
