import test from "node:test";
import assert from "node:assert/strict";
import {showVerticalLines,withVerticalLines,legacyGridKey} from "../lib/db-engine/table-appearance";
import {readViewConfig} from "../lib/db-engine/view-operators";
import {missingLegacyPropertyTable} from "../lib/database-property-store";

test("database columns have vertical gridlines on by default, including legacy saved views",()=>{
 assert.equal(showVerticalLines(undefined),true);
 assert.equal(showVerticalLines(null),true);
 assert.equal(showVerticalLines({}),true);
 assert.equal(showVerticalLines({filters:[],sorts:[]}),true);
 assert.equal(showVerticalLines({showVerticalLines:true}),true);
 assert.equal(showVerticalLines({showVerticalLines:false}),false);
});
test("vertical divider preference is independently stored in each view and preserves filters, sorts and presentation",()=>{
 const original={eventPresentation:"table",filterMode:"all",filters:[{id:"1",field:"name",operator:"contains",value:"Michael"}],sorts:[{id:"2",field:"name",direction:"asc"}]};
 const hidden=withVerticalLines(original,false);
 assert.equal(showVerticalLines(hidden),false);
 assert.equal(showVerticalLines(original),true,"original and other views remain unchanged");
 assert.equal(readViewConfig(hidden).filters.length,1);
 assert.equal(readViewConfig(hidden).sorts.length,1);
 assert.equal(hidden.eventPresentation,"table");
 const visible=withVerticalLines(hidden,true);
 assert.equal(showVerticalLines(visible),true);
 assert.equal(readViewConfig(visible).filters[0].value,"Michael");
});
test("legacy layout preference key is isolated by signed-in account and database",()=>{
 assert.notEqual(legacyGridKey("user-a","Events"),legacyGridKey("user-b","Events"));
 assert.notEqual(legacyGridKey("user-a","Events"),legacyGridKey("user-a","Characters"));
});

test("production compatibility handles missing legacy definitions without masking other errors",()=>{
 assert.equal(missingLegacyPropertyTable({code:"PGRST205",message:"Could not find the table 'public.database_property_definitions' in the schema cache"}),true);
 assert.equal(missingLegacyPropertyTable({code:"42P01",message:'relation "public.database_property_definitions" does not exist'}),true);
 assert.equal(missingLegacyPropertyTable({code:"PGRST301",message:"JWT expired"}),false);
 assert.equal(missingLegacyPropertyTable({code:"PGRST205",message:"Could not find public.profiles"}),false);
 assert.equal(missingLegacyPropertyTable(null),false);
});
