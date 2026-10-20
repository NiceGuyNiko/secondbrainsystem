import test from "node:test";
import assert from "node:assert/strict";
import {CHARACTER_FIELD_DEFINITIONS, FIRST_CHARACTERS, FIRST_RELATIONS, countMissingCharacters, storyKey} from "../lib/db-engine/nobody-special-characters";

test("all 23 author-supplied Characters have unique names and descriptive summaries",()=>{
 assert.equal(FIRST_CHARACTERS.length,23);
 assert.equal(new Set(FIRST_CHARACTERS.map(c=>storyKey(c.name))).size,23);
 assert.ok(FIRST_CHARACTERS.every(c=>c.summary.trim().length>8));
 assert.equal(FIRST_CHARACTERS.find(c=>c.name==="Blind Old Man")?.name,"Blind Old Man");
 assert.equal(FIRST_CHARACTERS.find(c=>c.name==="Phyrric")?.name,"Phyrric");
 assert.equal(FIRST_CHARACTERS.find(c=>c.name==="Miso Vancord")?.powerStatus,"Undetermined");
 assert.match(FIRST_CHARACTERS.find(c=>c.name==="Miso Vancord")?.ability??"",/tentative/i);
 assert.equal(FIRST_CHARACTERS.find(c=>c.name==="Kyla Starborn")?.powerStatus,"No powers yet");
 assert.equal(FIRST_CHARACTERS.find(c=>c.name==="Beck Borsk")?.powerStatus,"No powers");
 assert.equal(FIRST_CHARACTERS.find(c=>c.name==="Beck Borsk")?.curse,"Greed");
 assert.equal(FIRST_CHARACTERS.find(c=>c.name==="Billy Borsk")?.curse,"Greed");
 assert.equal(FIRST_CHARACTERS.filter(c=>c.blackout).length,5);
 assert.equal(countMissingCharacters(["Kage Ottoman","Alina Ottoman","Otto Ottoman","Michael Thade","Theodore Thade","Rosalina Thade"]),17);
 assert.equal(countMissingCharacters(FIRST_CHARACTERS.map(c=>c.name)),0);
});
test("relationships use only stated facts and resolve to existing fixture Characters",()=>{
 const names=new Set(FIRST_CHARACTERS.map(c=>c.name));
 for(const edge of FIRST_RELATIONS){assert.ok(names.has(edge.from));assert.ok(names.has(edge.to));}
 assert.equal(new Set(FIRST_RELATIONS.map(e=>e.from+"|"+e.type+"|"+e.to)).size,FIRST_RELATIONS.length);
 assert.ok(FIRST_RELATIONS.some(e=>e.from==="Kage Ottoman"&&e.type==="Killed"&&e.to==="Otto Ottoman"));
 assert.ok(FIRST_RELATIONS.some(e=>e.from==="Dr. Frank Critov"&&e.type==="Controls"&&e.to==="Camilla Macevic"));
 assert.ok(FIRST_RELATIONS.some(e=>e.from==="Alina Ottoman"&&e.type==="Parents"&&e.to==="Otto Ottoman"));
 assert.ok(!FIRST_RELATIONS.some(e=>e.from==="Camilla Macevic"&&e.type==="Parents"&&e.to==="Cassandra Macevic"),
  "Cassandra as Camilla's mother is not explicitly established yet");
 assert.ok(!FIRST_RELATIONS.some(e=>e.from==="Kage Ottoman"&&e.type==="Parents"),
  "Kage's parentage is not explicitly confirmed");
});
test("power status, affiliations, descriptions and the existing Gender field stay separate",()=>{
 assert.equal(CHARACTER_FIELD_DEFINITIONS.length,7);
 assert.equal(CHARACTER_FIELD_DEFINITIONS.find(p=>p.name==="Power status")?.type,"select");
 assert.ok(!CHARACTER_FIELD_DEFINITIONS.some(p=>p.name==="Gender"),
  "The existing Gender field must never be overwritten by the import");
 assert.ok(FIRST_CHARACTERS.some(c=>c.name==="Daniel Crump"&&c.affiliation?.includes("secretly Church")));
});
