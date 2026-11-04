import {index,integer,primaryKey,sqliteTable,text,uniqueIndex} from "drizzle-orm/sqlite-core";
export const studioCatalogs=sqliteTable("studio_catalogs",{
 id:text("id").primaryKey(),owner:text("owner").notNull()
},t=>[index("studio_catalog_owner").on(t.owner)]);
export const studioCatalogVersions=sqliteTable("studio_catalog_versions",{
 catalog:text("catalog").notNull(),version:integer("version").notNull(),requestId:text("request_id").notNull(),
 name:text("name").notNull(),digest:text("digest").notNull(),objectKey:text("object_key").notNull(),created:text("created").notNull(),requestDigest:text("request_digest")
},t=>[primaryKey({columns:[t.catalog,t.version]}),uniqueIndex("studio_catalog_request").on(t.catalog,t.requestId)]);
export const studioCatalogReaders=sqliteTable("studio_catalog_readers",{catalog:text("catalog").notNull(),reader:text("reader").notNull(),role:text("role").notNull().default("reader")},
 t=>[primaryKey({columns:[t.catalog,t.reader]}),index("studio_catalog_reader").on(t.reader)]);
