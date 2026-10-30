import type {SupabaseClient} from '@supabase/supabase-js';
import {applyCommand,emptyState,normalizeState,type Command,type State} from './domain';
export type Repository={load:()=>Promise<State>; send:(state:State,command:Command,requestId:string)=>Promise<State>};
export function demoRepository(storage:Pick<Storage,'getItem'|'setItem'>,ownerId:string,profileId:string,initial:()=>State=emptyState):Repository {
 const key='aaa-pages-databases-v1:'+encodeURIComponent(ownerId)+':'+encodeURIComponent(profileId);
 const load=async()=>{const raw=storage.getItem(key);if(!raw){const fresh=initial();storage.setItem(key,JSON.stringify(fresh));return fresh}const parsed=JSON.parse(raw) as State;
  if(parsed.version!==1||!Number.isInteger(parsed.revision)||!Array.isArray(parsed.pages)||!Array.isArray(parsed.records))throw new Error('Saved workspace is invalid. Export it before attempting recovery.');return normalizeState(parsed)};
 return {load,async send(state,command,requestId){
  const save=async()=>{
   const current=await load();
   const receiptKey=key+':receipt';const receipt=JSON.parse(storage.getItem(receiptKey)??'null') as {requestId:string;command:Command}|null;
   if(receipt?.requestId===requestId){if(JSON.stringify(receipt.command)!==JSON.stringify(command))throw new Error('Request ID reused.');return current}
   if(current.revision!==state.revision)throw new Error('Workspace changed. Reload before saving.');
   const next=applyCommand(current,command);storage.setItem(key,JSON.stringify(next));storage.setItem(receiptKey,JSON.stringify({requestId,command}));return next;
  };
  if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request(key,save);
  return save();
 }};
}
export function remoteRepository(client:SupabaseClient,profileId:string):Repository {
 let workspace:Promise<string>|undefined;
 const open=()=>workspace??=(async()=>{const {data,error}=await client.rpc('pd_open_workspace',{p_profile:profileId});if(error){workspace=undefined;throw new Error('Pages & Databases backend unavailable: '+error.message)}return data as string})();
 return {async load(){const id=await open();const {data,error}=await client.rpc('pd_load',{p_workspace:id});if(error)throw new Error(error.message);return normalizeState(data as State)},
 async send(state,command,requestId){const id=await open();const {data,error}=await client.rpc('pd_command',{p_workspace:id,p_expected_revision:state.revision,p_request_id:requestId,p_command:command});if(error)throw new Error(error.message);return normalizeState(data as State)}};
}
