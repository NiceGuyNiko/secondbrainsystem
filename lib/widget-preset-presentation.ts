/** Content modes never own or write widget geometry. */
export type PresetContentMode="expanded"|"comfortable"|"compact"|"minimal";
export function modeAtWidth(width:number):PresetContentMode{
  if(!Number.isFinite(width)||width<0)return "minimal";
  return width>=700?"expanded":width>=450?"comfortable":width>=280?"compact":"minimal";
}
const order:readonly PresetContentMode[]=["minimal","compact","comfortable","expanded"];
const boundaries=[0,280,450,700] as const;
/** During live resizing, require 12px beyond each boundary to change modes.
 * Initial mount and pointer release should use modeAtWidth directly. */
export function modeWithHysteresis(width:number,previous:PresetContentMode|null):PresetContentMode{
  if(previous===null)return modeAtWidth(width);
  if(!Number.isFinite(width)||width<0)return "minimal";
  let index=order.indexOf(previous);
  if(index<0)return modeAtWidth(width);
  while(index>0&&width<boundaries[index]-12)index--;
  while(index<order.length-1&&width>=boundaries[index+1]+12)index++;
  return order[index];
}
