// A reusable, opt-in worldbuilding DATABASE TEMPLATE, never a special database engine.
// Every entry below becomes an ordinary db_databases / db_properties record.
// Existing records, user-created properties and links remain canonical and untouched.
// Thoughts remain the unconstrained capture inbox. "Concept" is an editorial status,
// not a duplicate database or a claim that an in-world entity isn't real.
import type { SupabaseClient } from "@supabase/supabase-js";

type BaseType = "text"|"long_text"|"number"|"select"|"relation";
export type WorldPropertyTemplate = {
  readonly name:string;
  readonly type:BaseType;
  readonly options?:readonly string[];
  readonly target?:string;
  readonly multi?:boolean;
  readonly hierarchy?:boolean;
  readonly help?:string;
};
export type WorldDatabaseTemplate = {
  readonly name:string;
  readonly description:string;
  readonly properties:readonly WorldPropertyTemplate[];
};
const editorialStatus:WorldPropertyTemplate={
  name:"Development status",type:"select",
  options:["Concept","Developing","Established","Superseded"],
  help:"How resolved is this idea? This is separate from whether it exists in-world.",
};
export const WORLD_DATABASE_TEMPLATES:readonly WorldDatabaseTemplate[]=[
  {name:"Characters",description:"People, identities, their relationships, and evolving world involvement.",properties:[
    editorialStatus,
    {name:"Abilities",type:"relation",target:"Abilities",multi:true,help:"Select existing Ability records. A character may have several."},
    // Time-dependent memberships belong to Perspectives (Character × Event), not a timeless Character field.
    {name:"Home location",type:"relation",target:"Locations",multi:false},
  ]},
  {name:"Events",description:"World chronology, from large eras to individual moments.",properties:[
    editorialStatus,
    {name:"Scale",type:"select",options:["Era","Major Event","Event","Moment"],
      help:"Categorization of the event, not a separate database."},
    {name:"Chronology order",type:"number",
      help:"Optional relative story order across all Events and standalone Moments, including those without a parent."},
    {name:"Parent event",type:"relation",target:"Events",multi:false,hierarchy:true,
      help:"Link to an umbrella era or event. Parents cannot form cycles."},
    {name:"Locations",type:"relation",target:"Locations",multi:true},
    {name:"Involved groups",type:"relation",target:"Groups",multi:true},
    {name:"Chronology note",type:"long_text"},
  ]},
  {name:"Groups",description:"Organizations, factions, teams and communities with their own purposes.",properties:[
    editorialStatus,
    {name:"Purpose",type:"long_text",help:"What does this group exist to accomplish?"},
    {name:"Base location",type:"relation",target:"Locations",multi:false},
  ]},
  {name:"Locations",description:"Hierarchical places: continents, regions, cities, villages, sites.",properties:[
    editorialStatus,
    {name:"Scale",type:"select",options:["Continent","Region","Kingdom","Country","City","Village","Site","Other"]},
    {name:"Parent location",type:"relation",target:"Locations",multi:false,hierarchy:true,
      help:"A city can sit within a region, within a continent; cycles are invalid."},
    {name:"Description",type:"long_text"},
  ]},
  {name:"Power Systems",description:"Broad mechanisms behind powers, with independent rules and limitations.",properties:[
    editorialStatus,
    {name:"Description",type:"long_text"},
    {name:"Mechanism",type:"long_text"},
    {name:"Limitations",type:"long_text"},
    {name:"Costs",type:"long_text"},
  ]},
  {name:"Abilities",description:"Individual capabilities, each optionally tied to a Power System.",properties:[
    editorialStatus,
    {name:"Description",type:"long_text"},
    {name:"Power system",type:"relation",target:"Power Systems",multi:false,
      help:"The broad system this specific ability draws from; no forced system if unresolved."},
    {name:"Limitations",type:"long_text"},
  ]},
  {name:"Perspectives",description:"An event-scoped character snapshot: one record per Character × Event pairing. Not a copy of the Character or Event.",properties:[
    editorialStatus,
    {name:"Character",type:"relation",target:"Characters",multi:false},
    {name:"Event",type:"relation",target:"Events",multi:false},
    {name:"Groups at event",type:"relation",target:"Groups",multi:true,
      help:"The groups this Character actually belongs to DURING this Event, not an all-time membership."},
    {name:"Abilities at event",type:"relation",target:"Abilities",multi:true,
      help:"Known or accessible abilities during this Event; not automatically assumed for other Events."},
    {name:"Location at event",type:"relation",target:"Locations",multi:false},
    {name:"Knows",type:"long_text"},
    {name:"Believes",type:"long_text"},
    {name:"Wants",type:"long_text"},
    {name:"Experiences",type:"long_text"},
    {name:"Continuity note",type:"long_text"},
  ]},
  {name:"Lore",description:"In-world artifacts, beliefs, secrets, history, mysteries and rules.",properties:[
    editorialStatus,
    {name:"Lore kind",type:"select",options:["Artifact","History","Belief","Myth","World rule","Mystery","Other"],
      help:"Heart of Zyla would be a Lore entry with kind Artifact, without creating a forced Artifact database."},
    {name:"Description",type:"long_text"},
    {name:"Related characters",type:"relation",target:"Characters",multi:true},
    {name:"Related events",type:"relation",target:"Events",multi:true},
    {name:"Related locations",type:"relation",target:"Locations",multi:true},
    {name:"Related groups",type:"relation",target:"Groups",multi:true},
    {name:"Related power systems",type:"relation",target:"Power Systems",multi:true},
    {name:"Related abilities",type:"relation",target:"Abilities",multi:true},
    {name:"Related lore",type:"relation",target:"Lore",multi:true},
  ]},
] as const;

export function worldDbKey(name:string){return name.trim().toLocaleLowerCase("en");}
export function getTemplate(name:string):WorldDatabaseTemplate|undefined {
  return WORLD_DATABASE_TEMPLATES.find(d=>worldDbKey(d.name)===worldDbKey(name));
}
export type WorldSetupResult = {
  databasesCreated:number; databasesReused:number;
  propertiesCreated:number; selectOptionsExpanded:number;
  databaseIds:Record<string,string>;
};
type RowDb={id:string;name:string};
type RowProperty={id:string;database_id:string;name:string;type:string;config:Record<string,unknown>;position:number;version:number;archived_at:string|null};
function checked<T>(result:{data:T;error:{message:string}|null}):T {
  if(result.error)throw new Error(result.error.message);
  return result.data;
}
function propertyConfiguration(property:WorldPropertyTemplate,ids:Record<string,string>):Record<string,unknown> {
  if(property.type==="relation"){
    const target=ids[worldDbKey(property.target??"")];
    if(!target)throw new Error("Missing related database "+property.target);
    return {target_database_id:target,multi:property.multi!==false,
      ...(property.hierarchy?{hierarchy:true}:{})};
  }
  if(property.type==="select")return {options:[...(property.options??[])]};
  return {};
}
/**
 * Requires the user's authenticated staging browser client. No admin credentials.
 * Safe to rerun: never deletes records, and doesn't replace users' existing values,
 * connections, views, or property types. Appends newly required select choices.
 * Do not run automatically on sign-in or during a migration.
 */
export async function setupWorldbuildingDatabases(
  client:SupabaseClient,
  onProgress:(message:string)=>void=()=>{},
  dataset:"primary"|"acceptance"="acceptance",
):Promise<WorldSetupResult>{
  const {data:session,error}=await client.auth.getUser();
  if(error||!session.user)throw new Error("Sign in first.");
  const existing=checked(await client.from("db_databases")
    .select("id,name").is("archived_at",null).limit(1000)) as RowDb[];
  const seen=new Map<string,RowDb>();
  for(const d of existing){
    const key=worldDbKey(d.name);
    if(seen.has(key)&&getTemplate(key))throw new Error("Duplicate databases named "+d.name+". Resolve them before continuing.");
    seen.set(key,d);
  }
  const ids:Record<string,string>={};
  let databasesCreated=0,databasesReused=0,propertiesCreated=0,selectOptionsExpanded=0;
  for(const d of WORLD_DATABASE_TEMPLATES){
    onProgress("Checking "+d.name);
    const key=worldDbKey(d.name);
    const found=seen.get(key);
    if(found){ids[key]=found.id;databasesReused++;continue;}
    const id=crypto.randomUUID();
    checked(await client.rpc("db_create_database",{p_id:id,p_name:d.name,p_dataset:dataset}));
    ids[key]=id;databasesCreated++;
  }
  // Second pass: all target IDs are now available, including self-relations.
  for(const d of WORLD_DATABASE_TEMPLATES){
    const dbId=ids[worldDbKey(d.name)];
    onProgress("Connecting "+d.name+" properties");
    const existingProperties=checked(await client.from("db_properties")
      .select("id,database_id,name,type,config,position,version,archived_at").eq("database_id",dbId)
      .order("position").limit(1000)) as RowProperty[];
    const byName=new Map(existingProperties.map(p=>[worldDbKey(p.name),p]));
    for(const p of d.properties){
      const configuration=propertyConfiguration(p,ids);
      const prior=byName.get(worldDbKey(p.name));
      // An archived property is an explicit user deletion. NEVER reconstruct
      // it from template definitions, even on later setup runs.
      if(prior?.archived_at)continue;
      if(prior){
        if(prior.type!==p.type)throw new Error(
          d.name+" has an existing property named "+p.name+" with a different type. Review it before continuing.");
        if(p.type==="relation"){
          if(prior.config.target_database_id!==configuration.target_database_id)
            throw new Error(d.name+"."+p.name+" targets another database; leaving it unchanged.");
          // Legacy preexisting hierarchy property is not altered silently.
          if(p.hierarchy&&prior.config.hierarchy!==true){
            checked(await client.from("db_properties").update({
              config:{...prior.config,hierarchy:true,multi:false},
            }).eq("id",prior.id).eq("database_id",dbId).eq("version",prior.version).select("id").maybeSingle());
            // If this was an existing relation, it can be marked hierarchical
            // only after its current targets have been checked for cycles.
          }
        }
        if(p.type==="select"){
          const original=Array.isArray(prior.config.options)?prior.config.options.filter(
            (x):x is string=>typeof x==="string"):[];
          const added=(p.options??[]).filter(o=>!original.includes(o));
          if(added.length){
            checked(await client.from("db_properties").update({
              config:{...prior.config,options:[...original,...added]},
            }).eq("id",prior.id).eq("database_id",dbId));
            selectOptionsExpanded++;
          }
        }
        continue;
      }
      const row=checked(await client.from("db_properties").insert({
        database_id:dbId,name:p.name,type:p.type,config:configuration,
        position:existingProperties.length,
      }).select("id,database_id,name,type,config,position,version,archived_at").single()) as RowProperty;
      existingProperties.push(row);
      byName.set(worldDbKey(p.name),row);
      propertiesCreated++;
    }
  }
  onProgress("Worldbuilding databases connected");
  return {databasesCreated,databasesReused,propertiesCreated,selectOptionsExpanded,databaseIds:ids};
}
