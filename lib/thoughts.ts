import { supabase } from './supabase';
export type BlockType = 'paragraph'|'heading'|'checklist'|'bullet'|'numbered'|'quote'|'code'|'divider'|'reference';
export type Block = {id:string;type:BlockType;text:string;checked?:boolean;reference?:string};
export type Property = {id:string;name:string;type:'text'|'number'|'select'|'multi-select'|'date'|'checkbox';options?:string[]};
export type SavedView = {id:string;name:string;layout:'list'|'table'|'board';filter?:string;sort?:string;group?:string};
export type Thought = {id:string;title:string;content:{blocks?:Block[];[key:string]:unknown};updated_at:string;details:Details};
export type Details = {thought_id:string;parent_id:string|null;position:number;archived_at:string|null;version:number;collection:boolean;properties:Property[];views:SavedView[]};
export type Membership = {collection_id:string;thought_id:string;position:number;values_json:Record<string,unknown>};
export type Connection = {id:string;source_id:string;target_id:string;type:string};
export const connectionTypes=['relates_to','supports','contradicts','depends_on','inspired_by','references'];
export const symmetric=(type:string)=>type==='relates_to'||type==='contradicts';
export function validateValue(property:Property,value:unknown){
 if(value===null||value===undefined)return true;
 switch(property.type){case 'text':return typeof value==='string';case 'number':return typeof value==='number'&&Number.isFinite(value);case 'checkbox':return typeof value==='boolean';case 'date':return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value));case 'select':return typeof value==='string'&&!!property.options?.includes(value);case 'multi-select':return Array.isArray(value)&&value.every(v=>typeof v==='string'&&property.options?.includes(v));}
}
export function canParent(thoughts:Thought[],id:string,parent:string|null){const seen=new Set([id]);let next=parent;while(next){if(seen.has(next))return false;seen.add(next);next=thoughts.find(t=>t.id===next)?.details.parent_id||null;}return true;}
export function queryMembers(thoughts:Thought[],members:Membership[],collection:string,view:SavedView,search=''){
 const result=members.filter(m=>m.collection_id===collection).map(m=>({membership:m,thought:thoughts.find(t=>t.id===m.thought_id)})).filter((r):r is {membership:Membership;thought:Thought}=>!!r.thought&&!r.thought.details.archived_at);
 const filtered=result.filter(r=>(r.thought.title+' '+(r.thought.content.blocks||[]).map(b=>b.text).join(' ')).toLowerCase().includes(search.toLowerCase())&&(!view.filter||JSON.stringify(r.membership.values_json).toLowerCase().includes(view.filter.toLowerCase())));
 return filtered.sort((a,b)=>view.sort==='title'?a.thought.title.localeCompare(b.thought.title):view.sort?String(a.membership.values_json[view.sort]??'').localeCompare(String(b.membership.values_json[view.sort]??''),undefined,{numeric:true}):a.membership.position-b.membership.position);
}
function checked<T>(result:{data:T;error:{message:string}|null}){if(result.error)throw new Error(result.error.message);return result.data;}
export const thoughtStore={
 async load(){
  // Fetch bounded pages so PostgREST's default row cap cannot silently hide records.
  const pages=async(table:string,columns='*',type?:string)=>{const out:Record<string,unknown>[]=[];for(let offset=0;;offset+=500){let query=supabase.from(table).select(columns).order(table==='user_items'?'id':table==='thought_details'?'thought_id':table==='thought_memberships'?'collection_id':'id').range(offset,offset+499);if(type)query=query.eq('item_type',type);const data=checked(await query)||[];out.push(...(data as unknown as Record<string,unknown>[]));if(data.length<500)break;}return out;};
  const [rows,details,members,connections]=await Promise.all([pages('user_items','id,title,content,updated_at','thought'),pages('thought_details'),pages('thought_memberships'),pages('thought_connections')]);
  return {thoughts:rows.map(r=>({...r,details:details.find(d=>d.thought_id===r.id)})).filter(r=>r.details) as unknown as Thought[],members:members as unknown as Membership[],connections:connections as unknown as Connection[]};
 },
 async create(title:string){const id=crypto.randomUUID();checked(await supabase.rpc('create_thought',{p_id:id,p_title:title,p_content:{blocks:[]}}));return id;},
 async save(t:Thought){checked(await supabase.rpc('save_thought',{p_id:t.id,p_title:t.title,p_content:t.content,p_version:t.details.version,p_parent:t.details.parent_id,p_position:t.details.position,p_archive:t.details.archived_at}));},
 async collection(title:string,members:string[]){const id=crypto.randomUUID();checked(await supabase.rpc('create_thought_collection',{p_id:id,p_title:title,p_members:members}));return id;},
 async configure(id:string,patch:Partial<Pick<Details,'properties'|'views'|'collection'>>){checked(await supabase.from('thought_details').update(patch).eq('thought_id',id));},
 async member(collection_id:string,thought_id:string,values_json?:Record<string,unknown>){checked(await supabase.from('thought_memberships').upsert({collection_id,thought_id,...(values_json?{values_json}:{})}));},
 async leave(collection:string,thought:string){checked(await supabase.from('thought_memberships').delete().eq('collection_id',collection).eq('thought_id',thought));},
 async connect(source_id:string,target_id:string,type:string){checked(await supabase.from('thought_connections').insert({source_id,target_id,type}));},
 async disconnect(id:string){checked(await supabase.from('thought_connections').delete().eq('id',id));},
};
