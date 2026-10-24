import test from "node:test";
import assert from "node:assert/strict";
import {canPlaceWidgetRange,placeWidget,widgetColumnRanges,widgetLayoutBands,widgetVisualHierarchy,type WidgetDropTarget}
  from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const sec:WidgetPageSection={id:"layout",page_id:"page",title:"Layouts",position:0};
const make=(id:string,position:number):PageWidget=>({
  id,kind:"database",definition_id:"source-"+id,page_id:"page",title:id,
  width:12,height:2,position,config:{sectionId:sec.id,heightPx:280}
});
const drop=(targetId:string,edge:WidgetDropTarget["edge"],
  extra:Partial<WidgetDropTarget>={}):WidgetDropTarget=>({
  sectionId:sec.id,targetId,edge,...extra
});
const band=(items:PageWidget[])=>widgetLayoutBands(items)[0];
const widths=(items:PageWidget[])=>band(items).lanes.map(lane=>lane.width);
const approx=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<.005,
  `expected ${actual} ≈ ${expected}`);

function abcde(){
  let widgets=["A","B","C","D","E","F","G"].map(make);
  // Sketches 1–3: single widget, 50/50, and then three equal columns.
  widgets=placeWidget(widgets,[sec],"B",drop("A","right"));
  assert.deepEqual(widths(widgets),[6,6]);
  widgets=placeWidget(widgets,[sec],"C",drop("B","right"));
  assert.deepEqual(widths(widgets),[4,4,4]);
  // Sketch 4: D occupies the two right columns, not the space below A.
  widgets=placeWidget(widgets,[sec],"D",drop("B","span-below",{
    spanStartLane:1,spanLaneCount:2
  }));
  assert.equal(band(widgets).spans?.[0].startLane,1);
  assert.equal(band(widgets).spans?.[0].laneCount,2);
  // Sketch 5: A can independently be resized to align with D's bottom.
  widgets=widgets.map(widget=>widget.id==="A"
    ?{...widget,config:{...widget.config,heightPx:574}}:widget);
  // Sketch 6: E creates a fourth column. D can remain exactly B+C.
  widgets=placeWidget(widgets,[sec],"E",drop("C","right"));
  assert.deepEqual(band(widgets).lanes.map(lane=>lane.widgets[0].id),["A","B","C","E"]);
  assert.equal(band(widgets).spans?.[0].laneCount,2);
  return widgets;
}

test("sketches A–G: F divides D's lower region and G spans three columns",()=>{
  let widgets=abcde();
  // Sketch 7: No fifth column is created. F takes the left half of D,
  // which moves into the other existing lower column.
  widgets=placeWidget(widgets,[sec],"F",drop("D","split-span-left"));
  assert.equal(band(widgets).lanes.length,4);
  assert.equal(band(widgets).spans?.length??0,0);
  assert.deepEqual(band(widgets).lanes[1].widgets.map(w=>w.id),["B","F"]);
  assert.deepEqual(band(widgets).lanes[2].widgets.map(w=>w.id),["C","D"]);
  // Sketch 8: the long blue guide can span columns B through E.
  widgets=placeWidget(widgets,[sec],"G",drop("B","span-below",{
    spanStartLane:1,spanLaneCount:3
  }));
  const group=band(widgets);
  assert.equal(group.lanes.length,4);
  assert.deepEqual(group.spans?.map(s=>[s.startLane,s.laneCount]),[[1,3]]);
  assert.deepEqual(widgetVisualHierarchy(group).map(node=>node.laneCount),[1,3]);
  assert.equal(new Set(widgets.map(w=>w.id)).size,7);
  for(const w of widgets)assert.equal(w.definition_id,"source-"+w.id);
  assert.equal(widgets.find(w=>w.id==="A")?.config.heightPx,574);
});

test("side insertion can keep the existing 33% and split its companion 67%",()=>{
  let widgets=["A","B","C","D","E"].map(make);
  widgets=placeWidget(widgets,[sec],"B",drop("A","right"));
  widgets=placeWidget(widgets,[sec],"C",drop("B","right"));
  widgets=placeWidget(widgets,[sec],"D",drop("B","span-below",{
    spanStartLane:1,spanLaneCount:2
  }));
  widgets=placeWidget(widgets,[sec],"E",drop("C","right",{
    extendSpanWidgetId:"D",preserveGroupWidth:true
  }));
  const row=band(widgets);
  approx(row.lanes[0].width,4);
  row.lanes.slice(1).forEach(lane=>approx(lane.width,8/3));
  assert.equal(row.spans?.[0].laneCount,3);
  approx(widgets.find(w=>w.id==="D")!.width,8);
});

test("new column proportions can be 25/75 instead of the 50/50 default",()=>{
  const result=placeWidget(["A","B"].map(make),[sec],"B",
    drop("A","right",{newColumnShare:.75}));
  assert.deepEqual(widths(result),[3,9]);
  assert.equal(result.find(w=>w.id==="A")?.width,3);
  assert.equal(result.find(w=>w.id==="B")?.width,9);
});

test("splitting a three-column span retains its two-column remainder",()=>{
  let widgets=["A","B","C","D","E"].map(make);
  widgets=placeWidget(widgets,[sec],"B",drop("A","right"));
  widgets=placeWidget(widgets,[sec],"C",drop("B","right"));
  widgets=placeWidget(widgets,[sec],"D",drop("A","span-below",{
    spanStartLane:0,spanLaneCount:3
  }));
  widgets=placeWidget(widgets,[sec],"E",drop("D","split-span-right"));
  assert.deepEqual(band(widgets).lanes[2].widgets.map(w=>w.id),["C","E"]);
  assert.deepEqual(band(widgets).spans?.map(s=>[s.startLane,s.laneCount]),[[0,2]]);
  assert.equal(widgets.find(w=>w.id==="D")?.width,8);
});

test("one guide offers all ten contiguous ranges with four physical columns",()=>{
  assert.deepEqual(widgetColumnRanges(4).map(r=>[r.start+1,r.start+r.count]),[
    [1,1],[1,2],[1,3],[1,4],[2,2],[2,3],[2,4],[3,3],[3,4],[4,4]
  ]);
  const row=band(abcde());
  assert.equal(canPlaceWidgetRange(row,0,2),false); // crosses D at B+C
  assert.equal(canPlaceWidgetRange(row,0,3),true);  // contains D
  assert.equal(canPlaceWidgetRange(row,1,3),true);  // contains D
  assert.equal(canPlaceWidgetRange(row,1,2),true);  // the same B+C span
  assert.equal(canPlaceWidgetRange(row,1,1),false); // below D needs a split first
  assert.equal(canPlaceWidgetRange(row,2,2),false); // overlaps D sideways
});
