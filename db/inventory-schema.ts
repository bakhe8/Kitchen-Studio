import {index,integer,primaryKey,sqliteTable,text} from "drizzle-orm/sqlite-core";
// Append-only authoritative physical counts and mutually exclusive stock claims.
export const studioStockEvents=sqliteTable("studio_stock_events",{
 catalog:text("catalog").notNull(),request:text("request").notNull(),kind:text("kind").notNull(),fingerprint:text("fingerprint").notNull(),
 reservation:text("reservation").notNull(),project:text("project").notNull(),revision:integer("revision").notNull(),scope:text("scope").notNull(),
 units:text("units").notNull(),lines:text("lines").notNull(),note:text("note").notNull(),actor:text("actor").notNull(),created:text("created").notNull()
},t=>[primaryKey({columns:[t.catalog,t.request]}),index("studio_stock_reservation").on(t.catalog,t.reservation,t.kind)]);
