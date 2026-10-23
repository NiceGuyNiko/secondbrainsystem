// Fully isolated developer-preview data. These are illustrative records, not Nobody Special canon.
// IDs are created once and persisted by DemoDatabase; widget views always reuse the same records.
import {DEMO_USER_ID,type Row,type Tables} from "./client";

type Source={name:string;icon:string;fields:[string,string][];items:{title:string;values:Record<string,string|number|boolean>}[]};
const sourceData:Source[]=[
  {name:"Eras",icon:"hourglass",fields:[["Period","text"],["Order","number"],["Focus","text"]],items:[
    {title:"Before the Blackout",values:{Period:"Before the turning point",Order:1,Focus:"Origins and unresolved history"}},
    {title:"The Blackout Era",values:{Period:"During the crisis",Order:2,Focus:"Disappearance, memory, and change"}},
    {title:"After the Blackout",values:{Period:"Modern story timeline",Order:3,Focus:"Consequences and new discoveries"}}]},
  {name:"Events",icon:"calendar",fields:[["Era","relation"],["Kind","select"],["Significance","text"]],items:[
    {title:"The Blackout",values:{Kind:"Major event",Significance:"Michael's childhood encounter"}},
    {title:"The Cynthesite Attack",values:{Kind:"Major event",Significance:"Eyes from the past resurface"}},
    {title:"Theodore's Expedition",values:{Kind:"Historical thread",Significance:"Uncovering a world and its mysteries"}}]},
  {name:"Moments",icon:"sparkles",fields:[["Event","relation"],["Sequence","number"],["Story consequence","text"]],items:[
    {title:"Michael glimpses the girl",values:{Sequence:1,"Story consequence":"A memory he cannot yet explain"}},
    {title:"A familiar gaze reappears",values:{Sequence:2,"Story consequence":"The Blackout mystery deepens"}},
    {title:"Claire reveals the Star Child's fate",values:{Sequence:3,"Story consequence":"Recognition and a changed belief"}},
    {title:"The team examines expedition photos",values:{Sequence:4,"Story consequence":"Evidence of a hidden follower"}}]},
  {name:"Characters",icon:"users",fields:[["Role","text"],["Arc focus","text"],["Status","select"]],items:[
    {title:"Michael",values:{Role:"Protagonist","Arc focus":"What strength really means",Status:"In development"}},
    {title:"Camilla (Cammy)",values:{Role:"The Star Child","Arc focus":"Identity, memory, and survival",Status:"In development"}},
    {title:"Alina",values:{Role:"Character","Arc focus":"The Blackout perspective",Status:"In development"}},
    {title:"Theodore",values:{Role:"Explorer","Arc focus":"Motivations for strength",Status:"In development"}},
    {title:"Rosalina",values:{Role:"Michael's mother","Arc focus":"Family history",Status:"Concept"}}]},
  {name:"Perspectives",icon:"eye",fields:[["Character","relation"],["Moment","relation"],["Knowledge change","text"]],items:[
    {title:"Michael during the Blackout",values:{"Knowledge change":"Witnesses a girl but loses key memories"}},
    {title:"Camilla during the Blackout",values:{"Knowledge change":"Her experience remains partially unknown"}},
    {title:"Michael during the Cynthesite Attack",values:{"Knowledge change":"Recognizes the eyes, not the identity"}},
    {title:"Michael after Claire's revelation",values:{"Knowledge change":"Connects the Star Child and the attacker"}}]},
  {name:"Scenes",icon:"film",fields:[["Book","text"],["Stage","select"],["Dramatic purpose","text"]],items:[
    {title:"Blackout — remembered fragments",values:{Book:"Book One",Stage:"Planning","Dramatic purpose":"Plant a question for later"}},
    {title:"The Cynthesite encounter",values:{Book:"Book One",Stage:"Scene brief","Dramatic purpose":"Recognition without an answer"}},
    {title:"Claire's revelation",values:{Book:"Book One",Stage:"Outline","Dramatic purpose":"Reframe Michael's understanding"}},
    {title:"Photographic evidence",values:{Book:"Book Three",Stage:"Idea","Dramatic purpose":"Confirm the team's suspicions"}}]},
  {name:"Vision Goals",icon:"target",fields:[["Status","select"],["Outcome progress","number"],["Time horizon","text"]],items:[
    {title:"Publish Nobody Special — Book One",values:{Status:"Active","Outcome progress":24,"Time horizon":"Long-term"}},
    {title:"Build a consistent creative practice",values:{Status:"Active","Outcome progress":42,"Time horizon":"Ongoing"}},
    {title:"Build All About Action",values:{Status:"In development","Outcome progress":36,"Time horizon":"Long-term"}}]},
  {name:"Project Goals",icon:"flag",fields:[["Vision goal","relation"],["Progress","number"],["Status","select"]],items:[
    {title:"Finish the Book One scene outline",values:{Progress:65,Status:"In progress"}},
    {title:"Resolve the Blackout continuity",values:{Progress:40,Status:"In progress"}},
    {title:"Draft Chapter One",values:{Progress:20,Status:"Next"}},
    {title:"Prototype the widget system",values:{Progress:78,Status:"In progress"}}]},
  {name:"Projects",icon:"folder",fields:[["Project goal","relation"],["Stage","select"],["Priority","select"]],items:[
    {title:"Nobody Special — Book One",values:{Stage:"Planning",Priority:"High"}},
    {title:"Nobody Special — World Bible",values:{Stage:"Building",Priority:"High"}},
    {title:"All About Action V5",values:{Stage:"Prototype",Priority:"Medium"}}]},
  {name:"Tasks",icon:"check-square",fields:[["Project","relation"],["Status","select"],["Effort","text"]],items:[
    {title:"Map the Blackout's key moments",values:{Status:"Next",Effort:"60 min"}},
    {title:"Check Michael's chapter-one perspective",values:{Status:"Doing",Effort:"30 min"}},
    {title:"Draft the opening scene brief",values:{Status:"Next",Effort:"90 min"}},
    {title:"Test World View widgets",values:{Status:"Doing",Effort:"45 min"}},
    {title:"Review Project Goal contributions",values:{Status:"Backlog",Effort:"25 min"}}]}
];

export function widgetDemoFixtures(now=new Date()):Tables{
  const created=now.toISOString(),databases:Row[]=[],properties:Row[]=[],views:Row[]=[],records:Row[]=[],items:Row[]=[],relations:Row[]=[],perspectives:Row[]=[];
  const dbIds=new Map<string,string>(),fieldIds=new Map<string,string>(),recordIds=new Map<string,string>();
  for(const source of sourceData){
    const databaseId=crypto.randomUUID();dbIds.set(source.name,databaseId);
    databases.push({id:databaseId,user_id:DEMO_USER_ID,name:source.name,icon:source.icon,archived_at:null,created_at:created});
    source.fields.forEach(([name,type],position)=>{
      const id=crypto.randomUUID();fieldIds.set(source.name+":"+name,id);
      properties.push({id,user_id:DEMO_USER_ID,database_id:databaseId,name,type,position,config:{},archived_at:null});
    });
    views.push({id:crypto.randomUUID(),user_id:DEMO_USER_ID,database_id:databaseId,name:"All records",layout:"table",config:{}});
    source.items.forEach((item,index)=>{
      const id=crypto.randomUUID();recordIds.set(source.name+":"+item.title,id);
      items.push({id,user_id:DEMO_USER_ID,item_type:"thought",title:item.title,content:{blocks:[]},created_at:created,updated_at:created});
      const values_json=Object.fromEntries(Object.entries(item.values).map(([key,value])=>[fieldIds.get(source.name+":"+key),value]));
      records.push({record_id:id,user_id:DEMO_USER_ID,database_id:databaseId,sequence_no:index+1,version:1,position:index,values_json,archived_at:null});
    });
  }
  const connect=(fromDb:string,from:string,field:string,toDb:string,to:string)=>{
    const source_record_id=recordIds.get(fromDb+":"+from),property_id=fieldIds.get(fromDb+":"+field),target_record_id=recordIds.get(toDb+":"+to);
    if(source_record_id&&property_id&&target_record_id)relations.push({source_record_id,property_id,target_record_id,user_id:DEMO_USER_ID});
  };
  connect("Events","The Blackout","Era","Eras","The Blackout Era");
  connect("Events","The Cynthesite Attack","Era","Eras","After the Blackout");
  connect("Moments","Michael glimpses the girl","Event","Events","The Blackout");
  connect("Moments","A familiar gaze reappears","Event","Events","The Cynthesite Attack");
  connect("Moments","Claire reveals the Star Child's fate","Event","Events","The Cynthesite Attack");
  for(const [perspective,character,moment] of [
    ["Michael during the Blackout","Michael","Michael glimpses the girl"],
    ["Camilla during the Blackout","Camilla (Cammy)","Michael glimpses the girl"],
    ["Michael during the Cynthesite Attack","Michael","A familiar gaze reappears"],
    ["Michael after Claire's revelation","Michael","Claire reveals the Star Child's fate"]
  ]){
    connect("Perspectives",perspective,"Character","Characters",character);
    connect("Perspectives",perspective,"Moment","Moments",moment);
    perspectives.push({record_id:recordIds.get("Perspectives:"+perspective),character_id:recordIds.get("Characters:"+character),event_id:recordIds.get("Moments:"+moment)});
  }
  connect("Project Goals","Finish the Book One scene outline","Vision goal","Vision Goals","Publish Nobody Special — Book One");
  connect("Project Goals","Resolve the Blackout continuity","Vision goal","Vision Goals","Publish Nobody Special — Book One");
  connect("Project Goals","Draft Chapter One","Vision goal","Vision Goals","Publish Nobody Special — Book One");
  connect("Project Goals","Prototype the widget system","Vision goal","Vision Goals","Build All About Action");
  connect("Projects","Nobody Special — Book One","Project goal","Project Goals","Finish the Book One scene outline");
  connect("Projects","Nobody Special — World Bible","Project goal","Project Goals","Resolve the Blackout continuity");
  connect("Projects","All About Action V5","Project goal","Project Goals","Prototype the widget system");
  for(const task of ["Map the Blackout's key moments","Check Michael's chapter-one perspective","Draft the opening scene brief"])
    connect("Tasks",task,"Project","Projects","Nobody Special — Book One");
  connect("Tasks","Test World View widgets","Project","Projects","All About Action V5");

  const definitions:Row[]=[],pages:Row[]=[],pageWidgets:Row[]=[];
  const define=(name:string,source:string,renderer:"table"|"list"|"cards"|"timeline",extra:Row={})=>{
    const id=crypto.randomUUID();
    definitions.push({id,user_id:DEMO_USER_ID,name,database_id:dbIds.get(source),view_id:null,created_at:created,config:{renderer,density:"comfortable",color:"theme",...extra}});
    return id;
  };
  const w={
    eras:define("World Eras","Eras","timeline"),events:define("Historical Events","Events","cards"),moments:define("Story Moments","Moments","list"),perspectives:define("Character Perspectives","Perspectives","cards"),
    characters:define("Character Atlas","Characters","cards"),scenes:define("Scene Pipeline","Scenes","list"),vision:define("Vision Outcomes","Vision Goals","cards"),
    projectGoals:define("Project Goals","Project Goals","table"),projects:define("Active Projects","Projects","cards"),tasks:define("Next Actions","Tasks","list",{allowCreate:true,editable:true})
  };
  const page=(title:string,area:"library"|"goals",position:number,widgets:{id:string;width:number;height:number}[])=>{
    const pageId=crypto.randomUUID();pages.push({id:pageId,user_id:DEMO_USER_ID,area,title,position,created_at:created});
    widgets.forEach(({id,width,height},index)=>pageWidgets.push({id:crypto.randomUUID(),user_id:DEMO_USER_ID,page_id:pageId,definition_id:id,kind:"database",title:null,config:{},width,height,position:index}));
  };
  page("World View","library",0,[{id:w.eras,width:6,height:2},{id:w.events,width:6,height:2},{id:w.moments,width:6,height:3},{id:w.perspectives,width:6,height:3}]);
  page("Character Atlas","library",1,[{id:w.characters,width:8,height:3},{id:w.perspectives,width:4,height:3}]);
  page("Book One Studio","library",2,[{id:w.scenes,width:6,height:3},{id:w.moments,width:6,height:3},{id:w.projectGoals,width:12,height:2}]);
  page("Goals Overview","goals",0,[{id:w.vision,width:6,height:3},{id:w.projectGoals,width:6,height:3},{id:w.projects,width:6,height:3},{id:w.tasks,width:6,height:3}]);
  return {db_databases:databases,db_properties:properties,db_views:views,db_records:records,db_relations:relations,db_perspectives:perspectives,
    aaa_widget_definitions:definitions,aaa_library_pages:pages,aaa_page_widgets:pageWidgets,user_items:items};
}
