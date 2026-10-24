// A chronology address is derived from current sibling order, not stored as an ID.
// Moving an Era or Event changes its address and every descendant's address, while
// all permanent record IDs and Character × Event perspective IDs stay unchanged.
export type NumberedEvent={id:string;parentId:string|null;order:number|null;sequence:number;position?:number};

export function chronologyAddresses<T extends NumberedEvent>(events:readonly T[]):Map<string,string>{
  const byId=new Map(events.map(event=>[event.id,event]));
  const children=new Map<string,T[]>();
  const roots:T[]=[];
  for(const event of events){
    if(event.parentId&&event.parentId!==event.id&&byId.has(event.parentId)){
      const items=children.get(event.parentId)??[];items.push(event);children.set(event.parentId,items);
    }else roots.push(event);
  }
  const sort=(items:readonly T[])=>[...items].sort((a,b)=>{
    if(a.order!==null&&b.order!==null&&a.order!==b.order)return a.order-b.order;
    if(a.order!==null&&b.order===null)return -1;
    if(b.order!==null&&a.order===null)return 1;
    return (a.position??a.sequence)-(b.position??b.sequence)||a.sequence-b.sequence;
  });
  const addresses=new Map<string,string>();
  const walk=(siblings:readonly T[],prefix:string,ancestors:Set<string>)=>{
    sort(siblings).forEach((event,index)=>{
      if(ancestors.has(event.id)||addresses.has(event.id))return;
      const path=prefix?`${prefix}.${index+1}`:String(index+1);
      addresses.set(event.id,path);
      walk(children.get(event.id)??[],path,new Set([...ancestors,event.id]));
    });
  };
  walk(roots,"",new Set());
  // Historical malformed links must not hide records or cause recursive loops.
  walk(events.filter(event=>!addresses.has(event.id)),"",new Set());
  return addresses;
}

export function perspectiveChronologyLabel(addresses:Map<string,string>,eventId:string,characterName:string){
  const prefix=addresses.get(eventId);
  return prefix?`${prefix}.${characterName}`:characterName;
}
