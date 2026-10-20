export function optionMatches(options:readonly string[],query:string):string[]{
 const needle=query.trim().toLocaleLowerCase();
 return options.filter(o=>o.toLocaleLowerCase().includes(needle));
}
export function canCreateOption(options:readonly string[],query:string):boolean{
 const proposed=query.trim();
 return proposed.length>0&&proposed.length<=80&&options.length<60&&
  !options.some(o=>o.trim().toLocaleLowerCase()===proposed.toLocaleLowerCase());
}
