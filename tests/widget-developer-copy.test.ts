import test from "node:test";
import assert from "node:assert/strict";
import {copyWidgetBlueprint,defaultWidgetConfig,widgetConfig,type PageWidget,type WidgetDefinition} from "../lib/widget-system";

const definition:WidgetDefinition={id:"master",name:"Original master",database_id:null,view_id:null,
  config:{renderer:"table"}};

test("dragging an edited page widget copies its displayed title, database, view, and filters",()=>{
  const instance:PageWidget={id:"placed",page_id:"library",definition_id:"master",kind:"database",
    title:"Michael's timeline",position:2,width:6,height:4,
    config:{databaseOverride:"characters",viewOverride:"my-view",renderer:"timeline",sectionId:"history"}};
  const effective={...defaultWidgetConfig,renderer:"timeline" as const,
    filters:[{id:"filter-1",propertyId:"actor",operator:"equals" as const,value:"Michael"}]};
  const copied=copyWidgetBlueprint(definition,{databaseId:"characters",viewId:"my-view"},effective,instance);
  assert.equal(copied.name,"Michael's timeline");
  assert.equal(copied.database_id,"characters");
  assert.equal(copied.view_id,"my-view");
  assert.equal(copied.config.renderer,"timeline");
  assert.equal(copied.config.filters.length,1);
  assert.equal("sectionId" in copied.config,false);
});

test("a new unconnected widget remains named without adding Copy or a phantom database",()=>{
  const copied=copyWidgetBlueprint({...definition,name:"Widget workshop draft"},
    {databaseId:null,viewId:null},widgetConfig(definition.config));
  assert.equal(copied.name,"Widget workshop draft");
  assert.equal(copied.database_id,null);
  assert.equal(copied.view_id,null);
});
