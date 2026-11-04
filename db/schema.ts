import {index,integer,primaryKey,sqliteTable,text,uniqueIndex} from "drizzle-orm/sqlite-core";

export const studioMembers=sqliteTable("studio_members",{
 userId:text("user_id").primaryKey(),email:text("email").notNull(),
},t=>[index("studio_member_email").on(t.email)]);

export const studioProjects=sqliteTable("studio_projects",{
 id:text("id").primaryKey(),owner:text("owner").notNull(),
},t=>[index("studio_project_owner").on(t.owner)]);

export const studioAccess=sqliteTable("studio_access",{
 projectId:text("project_id").notNull(),member:text("member").notNull(),role:text("role").notNull(),
},t=>[primaryKey({columns:[t.projectId,t.member]}),index("studio_shared_member").on(t.member)]);

export const studioVersions=sqliteTable("studio_versions",{
 projectId:text("project_id").notNull(),revision:integer("revision").notNull(),requestId:text("request_id").notNull(),actor:text("actor").notNull(),
 name:text("name").notNull(),digest:text("digest").notNull(),bytes:integer("bytes").notNull(),updated:text("updated").notNull(),requestDigest:text("request_digest"),
},t=>[primaryKey({columns:[t.projectId,t.revision]}),uniqueIndex("studio_save_request").on(t.projectId,t.requestId)]);

export const studioReleases=sqliteTable("studio_releases",{
 projectId:text("project_id").notNull(),revision:integer("revision").notNull(),issuer:text("issuer").notNull(),
 digest:text("digest").notNull(),designKey:text("design_key").notNull(),totalMinor:integer("total_minor").notNull(),scopeJson:text("scope_json"),
 issued:text("issued").notNull(),
},t=>[primaryKey({columns:[t.projectId,t.revision]})]);

export const studioBatches=sqliteTable("studio_batches",{
 projectId:text("project_id").notNull(),revision:integer("revision").notNull(),designKey:text("design_key").notNull(),
 unitIds:text("unit_ids").notNull(),partKeys:text("part_keys"),issuer:text("issuer").notNull(),digest:text("digest").notNull(),
 materialMinor:integer("material_minor").notNull(),issued:text("issued").notNull()
},t=>[primaryKey({columns:[t.projectId,t.revision,t.designKey]}),index("studio_batch_project").on(t.projectId)]);

export * from './catalog-schema';
export * from './job-schema';
export * from './inventory-schema';
export * from './approval-schema';
