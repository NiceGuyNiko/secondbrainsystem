import test from "node:test";
import assert from "node:assert/strict";
import type {SupabaseClient} from "@supabase/supabase-js";
import {WORLD_DATABASE_TEMPLATES,setupWorldbuildingDatabases} from "../lib/db-engine/worldbuilding-templates";

test("reapplying worldbuilding templates never resurrects a deleted property", async()=>{
 const existingDBs=WORLD_DATABASE_TEMPLATES.map((d,i)=>({id:"db-"+i,name:d.name}));
 const ids=new Map(existingDBs.map(d=>[d.name,d.id]));
 const removed=[
  {id:"removed-status",name:"Development status",type:"select",database_id:ids.get("Characters")!,
   config:{options:["Concept","Developing","Established","Superseded"]},position:0,version:3,archived_at:"2026-10-20T00:00:00Z"},
  {id:"removed-parent",name:"Parent event",type:"relation",database_id:ids.get("Events")!,
   config:{target_database_id:ids.get("Events"),multi:false,hierarchy:true},position:0,version:2,archived_at:"2026-10-20T00:00:00Z"},
 ];
 type Row=(typeof removed)[number];
 const props:Row[]=[...removed];
 const inserted:string[]=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:"user"}},error:null})},
  from:(table:string)=>({
   select:(_columns:string)=>({
    is:(_column:string,_value:null)=>({
     limit:async(_limit:number)=>({data:existingDBs,error:null}),
    }),
    eq:(_column:string,value:string)=>({
     order:(_order:string)=>({
      limit:async(_limit:number)=>({data:props.filter(p=>p.database_id===value),error:null}),
     }),
    }),
   }),
   insert:(data:{database_id:string;name:string;type:string;config:Record<string,unknown>;position:number})=>({
    select:(_columns:string)=>({
     single:async()=>{
      inserted.push(data.database_id+"|"+data.name);
      const result={...data,id:"insert-"+inserted.length,version:1,archived_at:null};
      props.push(result as Row);
      return {data:result,error:null};
     },
    }),
   }),
   update:(_data:unknown)=>({eq:()=>({eq:()=>({eq:()=>({select:()=>({
    maybeSingle:async()=>({data:null,error:null}),
   })})})})}),
  }),
 } as unknown as SupabaseClient;
 const report=await setupWorldbuildingDatabases(client);
 assert.equal(report.databasesCreated,0);
 assert.equal(report.databasesReused,WORLD_DATABASE_TEMPLATES.length);
 assert.ok(!inserted.includes(ids.get("Characters")+"|Development status"),
   "archived Development status must remain deleted");
 assert.ok(!inserted.includes(ids.get("Events")+"|Parent event"),
   "archived hierarchy property must remain deleted");
 assert.equal(props.filter(p=>p.id==="removed-status")[0].archived_at,"2026-10-20T00:00:00Z");
 assert.equal(props.filter(p=>p.id==="removed-parent")[0].archived_at,"2026-10-20T00:00:00Z");
});
