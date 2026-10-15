import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateValue,canParent,queryMembers,type Thought} from '../lib/thoughts';
test('typed property validation and nested cycle prevention',()=>{
 assert.equal(validateValue({id:'n',name:'Number',type:'number'},'5'),false);
 assert.equal(validateValue({id:'n',name:'Number',type:'number'},NaN),false);
 assert.equal(validateValue({id:'s',name:'State',type:'select',options:['Done']},'Done'),true);
 assert.equal(validateValue({id:'s',name:'State',type:'multi-select',options:['Done']},['Wrong']),false);
 const thoughts=[{id:'a',details:{parent_id:'b'}},{id:'b',details:{parent_id:null}}] as Thought[];
 assert.equal(canParent(thoughts,'b','a'),false);assert.equal(canParent(thoughts,'a',null),true);
});
test('views share canonical records and sort numbers correctly',()=>{
 const thoughts=[{id:'a',title:'A',content:{blocks:[]},details:{archived_at:null}},{id:'b',title:'B',content:{blocks:[]},details:{archived_at:null}}] as unknown as Thought[];
 const members=[{collection_id:'c',thought_id:'a',position:0,values_json:{n:10}},{collection_id:'c',thought_id:'b',position:1,values_json:{n:2}}];
 const rows=queryMembers(thoughts,members,'c',{id:'table',name:'Table',layout:'table',sort:'n'});
 assert.equal(rows[0].thought,thoughts[1]);assert.deepEqual(rows.map(r=>r.membership.values_json.n),[2,10]);
});
