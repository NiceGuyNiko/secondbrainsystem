/** The divider preference lives on each saved database view. Existing views
 * predate this option, so their default is visible (the requested design).
 * Explicit false stays false; no global database/style mutation is required. */
export function showVerticalLines(config:unknown):boolean{
  if(!config||typeof config!=="object"||Array.isArray(config))return true;
  return (config as Record<string,unknown>).showVerticalLines!==false;
}
export function withVerticalLines(config:Record<string,unknown>|undefined|null,show:boolean):Record<string,unknown>{
  return {...config,showVerticalLines:show};
}
/** Legacy engine keeps its UI preference per authenticated user and category;
 * its older planning-backed records aren't migrated in this release. */
export function legacyGridKey(userId:string,database:string):string{
  return "aaa-database-grid-lines-v1:"+userId+":"+database;
}
