import {integer,primaryKey,sqliteTable,text} from "drizzle-orm/sqlite-core";
// Who put each approval stamp or technician attestation into a saved revision. The stamp itself lives inside the project
// JSON, where any editor can type any name; this table is written by the server from the signed-in session.
export const studioApprovals=sqliteTable("studio_approvals",{
 projectId:text("project_id").notNull(),revision:integer("revision").notNull(),kind:text("kind").notNull(),subject:text("subject").notNull(),
 stampKey:text("stamp_key").notNull(),stampName:text("stamp_name").notNull(),stampDate:text("stamp_date").notNull(),detail:text("detail").notNull(),
 actor:text("actor").notNull(),actorName:text("actor_name").notNull(),recorded:text("recorded").notNull()
},t=>[primaryKey({columns:[t.projectId,t.revision,t.kind,t.subject]})]);
