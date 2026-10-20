import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHARACTER_FIELD_DEFINITIONS, FIRST_CHARACTERS, FIRST_RELATIONS, storyKey,
} from "./nobody-special-characters";

// This import is deliberately user-triggered and user-scoped: it uses the session's
// public Supabase client, never a service-role/admin key. Partial retries are safe:
// match within the Characters database by title; don't overwrite populated fields.
type Db = {id:string;name:string};
type Property = {id:string;database_id:string;name:string;type:string;config:{target_database_id?:string;options?:string[]};position:number};
type RecordRow = {record_id:string;version:number;values_json:Record<string,unknown>};
type ItemRow = {id:string;title:string};
type RelationRow = {id:string;property_id:string;source_record_id:string;target_record_id:string};

export type CharacterImportReport = {
  created:number; reused:number; fieldsFilled:number; linksCreated:number;
  databaseId:string; total:number; eventLinksCreated:number;
};
type Notify = (description:string)=>void;
function must<T>(result:{data:T;error:{message:string}|null}):T {
  if(result.error)throw new Error(result.error.message);
  return result.data;
}
function assertUniqueTitles(pages:ItemRow[]) {
  const seen = new Set<string>();
  for (const page of pages) {
    const key=storyKey(page.title);
    if(seen.has(key))throw new Error("Duplicate Character names exist. Resolve duplicates before importing.");
    seen.add(key);
  }
}
export async function importFirstCharactersToStaging(client:SupabaseClient,notify:Notify=()=>{}):Promise<CharacterImportReport>{
  const {data:session,error:authError}=await client.auth.getUser();
  if(authError||!session.user)throw new Error("Sign in to your staging account first.");
  const dbs=must(await client.from("db_databases").select("id,name").is("archived_at",null)) as Db[];
  let characters=dbs.find(d=>storyKey(d.name)==="characters");
  if(!characters) {
    notify("Creating Characters database");
    const id=crypto.randomUUID();
    must(await client.rpc("db_create_database",{p_id:id,p_name:"Characters",p_dataset:"acceptance"}));
    characters={id,name:"Characters"};
  }
  const databaseId=characters.id;
  notify("Checking existing Characters and properties");

  const definitions=must(await client.from("db_properties").select("id,database_id,name,type,config,position")
    .eq("database_id",databaseId).is("archived_at",null).order("position")) as Property[];
  const props=new Map(definitions.map(p=>[storyKey(p.name),p]));
  const fields=[...CHARACTER_FIELD_DEFINITIONS,
    ...(["Parents","Siblings","Spouse","Killed","Controls"] as const)
      .map(name=>({name,type:"relation" as const,config:{target_database_id:databaseId,multi:true}}))];
  for(const field of fields){
    const existing=props.get(storyKey(field.name));
    if(existing) {
      if(existing.type!==field.type)throw new Error("Property “"+field.name+"” has a different type. Please rename it or review the import.");
      if(field.type==="relation"&&existing.config.target_database_id!==databaseId)
        throw new Error("Existing relation “"+field.name+"” targets a different database.");
      if(field.type==="select"&&existing.config.options &&
         !["Established","Undetermined","No powers","No powers yet"].every(o=>existing.config.options?.includes(o)))
        throw new Error("The existing Power status choices don't support the starter dataset.");
      continue;
    }
    const result=must(await client.from("db_properties").insert({
      database_id:databaseId,name:field.name,type:field.type,
      config:("config" in field)?field.config:{},
      position:props.size,
    }).select("id,database_id,name,type,config,position").single()) as Property;
    props.set(storyKey(result.name),result);
  }

  const existing=must(await client.from("db_records").select("record_id,version,values_json")
    .eq("database_id",databaseId).is("archived_at",null).limit(1000)) as RecordRow[];
  const ids=existing.map(r=>r.record_id);
  const pages=ids.length ? must(await client.from("user_items").select("id,title").in("id",ids)) as ItemRow[] : [];
  if(pages.length!==ids.length)throw new Error("Some existing Character pages are unavailable; cannot deduplicate safely.");
  assertUniqueTitles(pages);
  const byTitle=new Map<string,RecordRow>();
  const byId=new Map(existing.map(r=>[r.record_id,r]));
  for(const p of pages) {
    const r=byId.get(p.id);
    if(r)byTitle.set(storyKey(p.title),r);
  }
  let created=0,reused=0,fieldsFilled=0,linksCreated=0,eventLinksCreated=0;

  for (let i=0;i<FIRST_CHARACTERS.length;i++) {
    const c=FIRST_CHARACTERS[i];
    notify("Saving Character "+(i+1)+" of "+FIRST_CHARACTERS.length+": "+c.name);
    let rec=byTitle.get(storyKey(c.name));
    if(!rec){
      const id=crypto.randomUUID();
      must(await client.rpc("db_create_record",{p_id:id,p_database_id:databaseId,p_name:c.name}));
      rec={record_id:id,version:1,values_json:{}};
      byTitle.set(storyKey(c.name),rec);created++;
    }else reused++;

    const entries:ReadonlyArray<[string,string|undefined]>=[
      ["Summary",c.summary],["Affiliation",c.affiliation],["Story role",c.role],
      ["Power status",c.powerStatus],["Ability",c.ability],["Curse",c.curse],
      ["Timeline note",c.timeline],
    ];
    const next={...rec.values_json};
    let updated=0;
    for(const [name,value] of entries) {
      if(value===undefined)continue;
      const property=props.get(storyKey(name));
      if(!property)throw new Error("The "+name+" property is missing.");
      if(next[property.id]!==undefined&&next[property.id]!==null&&next[property.id]!=="")continue;
      next[property.id]=value;
      updated++;
    }
    if(updated){
      const saved=must(await client.from("db_records").update({values_json:next})
        .eq("record_id",rec.record_id).eq("database_id",databaseId).eq("version",rec.version)
        .select("version").maybeSingle()) as {version:number}|null;
      if(!saved)throw new Error("Character changed during import. Retry; existing values will be preserved.");
      rec.version=saved.version;rec.values_json=next;fieldsFilled+=updated;
    }
  }

  // Link only explicit relationships given by the author. Do not infer
  // parents from shared surnames, or assume that a spouse is a child's parent.
  const current=must(await client.from("db_relations")
    .select("id,property_id,source_record_id,target_record_id")) as RelationRow[];
  const has=new Set(current.map(r=>[r.property_id,r.source_record_id,r.target_record_id].join("|")));
  for(const edge of FIRST_RELATIONS){
    const property=props.get(storyKey(edge.type));
    const from=byTitle.get(storyKey(edge.from));
    const to=byTitle.get(storyKey(edge.to));
    if(!property||!from||!to)throw new Error("Missing relation endpoints in import.");
    const key=[property.id,from.record_id,to.record_id].join("|");
    if(has.has(key))continue;
    notify("Linking "+edge.from+" → "+edge.to);
    must(await client.rpc("db_link",{p_property_id:property.id,p_source:from.record_id,p_target:to.record_id}));
    has.add(key);linksCreated++;
  }

  // Reuse The Blackout event and the existing Experienced relation, if present.
  // Do not fabricate an event or overwrite links a user already curated.
  const events=dbs.find(d=>storyKey(d.name)==="events");
  const experienced=definitions.find(p=>storyKey(p.name)==="experienced"&&p.type==="relation"
    &&p.config.target_database_id===events?.id);
  if(events&&experienced) {
    const eventRecords=must(await client.from("db_records").select("record_id").eq("database_id",events.id).is("archived_at",null)) as Array<{record_id:string}>;
    const eventIds=eventRecords.map(r=>r.record_id);
    const eventPages=eventIds.length?must(await client.from("user_items").select("id,title").in("id",eventIds)) as ItemRow[]:[];
    const blackout=eventPages.find(e=>storyKey(e.title)==="the blackout"||storyKey(e.title)==="blackout");
    if(blackout){
      for(const c of FIRST_CHARACTERS.filter(x=>x.blackout)){
        const rec=byTitle.get(storyKey(c.name));
        if(!rec)continue;
        const key=[experienced.id,rec.record_id,blackout.id].join("|");
        if(has.has(key))continue;
        must(await client.rpc("db_link",{p_property_id:experienced.id,p_source:rec.record_id,p_target:blackout.id}));
        has.add(key);eventLinksCreated++;
      }
    }
  }
  notify("Import complete");
  return {created,reused,fieldsFilled,linksCreated,databaseId,total:FIRST_CHARACTERS.length,eventLinksCreated};
}
