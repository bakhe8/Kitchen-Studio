import {index,integer,primaryKey,sqliteTable,text,uniqueIndex} from "drizzle-orm/sqlite-core";
export const studioJobEvents=sqliteTable("studio_job_events",{
 project:text("project").notNull(),unit:text("unit").notNull(),seq:integer("seq").notNull(),receipt:text("receipt").notNull(),
 revision:integer("revision").notNull(),requestId:text("request_id").notNull(),requestHash:text("request_hash").notNull(),actor:text("actor").notNull(),actorName:text("actor_name").notNull(),action:text("action").notNull(),state:text("state").notNull(),payload:text("payload").notNull(),created:text("created").notNull(),
},t=>[primaryKey({columns:[t.project,t.unit,t.seq]}),uniqueIndex("job_event_request").on(t.project,t.requestId),index("job_event_receipt").on(t.project,t.receipt)]);
