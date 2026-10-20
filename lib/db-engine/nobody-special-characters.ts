// First acceptance-test fixture. Source: author's October 2026 Characters list.
// Unknown facts are deliberately omitted. Tentative ideas remain clearly tentative.
// Import only by explicit action of the signed-in staging user; never use production/admin seeds.
export type StoryCharacter = {
  name: string;
  summary: string;
  affiliation?: string;
  role?: string;
  powerStatus?: "Established" | "Undetermined" | "No powers" | "No powers yet";
  ability?: string;
  curse?: string;
  timeline?: string;
  blackout?: boolean;
};
export const FIRST_CHARACTERS: readonly StoryCharacter[] = [
  {name:"Kage Ottoman",summary:"Alina Ottoman's brother; killed Otto Ottoman."},
  {name:"Alina Ottoman",summary:"Kage Ottoman's sister and Otto Ottoman's daughter."},
  {name:"Otto Ottoman",summary:"Leader of the Third Kingdom.",affiliation:"Third Kingdom",role:"Leader"},
  {name:"Michael Thade",summary:"Son of Theodore Thade and Rosalina Thade; kidnapped as a child during the Blackout.",timeline:"Kidnapped during the Blackout",blackout:true},
  {name:"Theodore Thade",summary:"Military leader in Orbis.",affiliation:"Orbis military",role:"Military leader"},
  {name:"Rosalina Thade",summary:"Military leader in Orbis; killed during the Blackout while saving Michael.",affiliation:"Orbis military",role:"Military leader",timeline:"Died saving Michael during the Blackout",blackout:true},
  {name:"Roy McCoy",summary:"Orbis military member who becomes a judge in the aftermath of the Blackout.",affiliation:"Orbis military",role:"Military member; later judge",timeline:"Becomes a judge after the Blackout"},
  {name:"Daniel Crump",summary:"Military leader in Orbis; secretly working for the Church of the Champion.",affiliation:"Orbis military; secretly Church of the Champion",role:"Military leader"},
  {name:"Matthew Mayder",summary:"Orbis recruit with wind-based powers.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"Established",ability:"Wind-based powers"},
  {name:"Beck Borsk",summary:"Orbis recruit with no powers, but cursed by greed.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"No powers",curse:"Greed"},
  {name:"Billy Borsk",summary:"Orbis recruit with no powers, but cursed by greed.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"No powers",curse:"Greed"},
  {name:"Victoria Vancord",summary:"Orbis recruit who can enhance other people's abilities.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"Established",ability:"Enhances other people's abilities"},
  {name:"Miso Vancord",summary:"Orbis recruit; power not yet established. It might involve strings.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"Undetermined",ability:"Possibly related to strings (tentative; not established)"},
  {name:"Joel Neemon",summary:"Orbis recruit who can resize things.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"Established",ability:"Can resize things"},
  {name:"Kyla Starborn",summary:"Orbis recruit with no powers yet.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"No powers yet"},
  {name:"Barron Brewer",summary:"Orbis recruit with no powers yet.",affiliation:"Orbis recruits",role:"Recruit",powerStatus:"No powers yet"},
  {name:"Camilla Macevic",summary:"Daughter of King Phillip of Orbis; kidnapped during the Blackout.",affiliation:"Orbis royal family",timeline:"Kidnapped during the Blackout",blackout:true},
  {name:"Alexander Macevic",summary:"Camilla's brother; becomes King of Orbis during the Blackout.",affiliation:"Orbis royal family",role:"King of Orbis after the Blackout succession",timeline:"Becomes king during the Blackout",blackout:true},
  {name:"Cassandra Macevic",summary:"King Phillip's wife; died from a forest illness before the Blackout.",affiliation:"Orbis royal family",timeline:"Died from forest illness before the Blackout"},
  {name:"Phillip Macevic",summary:"King of Orbis; died at the beginning of the Blackout.",affiliation:"Orbis royal family",role:"King of Orbis",timeline:"Died at the beginning of the Blackout",blackout:true},
  {name:"Dr. Frank Critov",summary:"Church of the Champion member; controls Camilla after the Blackout.",affiliation:"Church of the Champion",role:"Member",timeline:"Controls Camilla after the Blackout"},
  {name:"Phyrric",summary:"Holder of the Book of Records; leads the Scribes, pursuing a goal similar to the Church of the Champion.",affiliation:"The Scribes",role:"Leader of the Scribes"},
  {name:"Blind Old Man",summary:"Member of the Scribes who helps Phyrric locate runes.",affiliation:"The Scribes",role:"Member"},
] as const;

// Edges are confirmed assertions, not inferred from shared surnames.
export type StoryRelationType = "Parents" | "Siblings" | "Spouse" | "Killed" | "Controls";
export const FIRST_RELATIONS: ReadonlyArray<{from:string;type:StoryRelationType;to:string}> = [
  {from:"Alina Ottoman",type:"Parents",to:"Otto Ottoman"},
  {from:"Michael Thade",type:"Parents",to:"Theodore Thade"},
  {from:"Michael Thade",type:"Parents",to:"Rosalina Thade"},
  {from:"Camilla Macevic",type:"Parents",to:"Phillip Macevic"},
  {from:"Kage Ottoman",type:"Siblings",to:"Alina Ottoman"},
  {from:"Alina Ottoman",type:"Siblings",to:"Kage Ottoman"},
  {from:"Camilla Macevic",type:"Siblings",to:"Alexander Macevic"},
  {from:"Alexander Macevic",type:"Siblings",to:"Camilla Macevic"},
  {from:"Cassandra Macevic",type:"Spouse",to:"Phillip Macevic"},
  {from:"Phillip Macevic",type:"Spouse",to:"Cassandra Macevic"},
  {from:"Kage Ottoman",type:"Killed",to:"Otto Ottoman"},
  {from:"Dr. Frank Critov",type:"Controls",to:"Camilla Macevic"},
];
export const CHARACTER_FIELD_DEFINITIONS = [
  {name:"Summary",type:"long_text"},
  {name:"Affiliation",type:"text"},
  {name:"Story role",type:"text"},
  {name:"Power status",type:"select",config:{options:["Established","Undetermined","No powers","No powers yet"]}},
  {name:"Ability",type:"long_text"},
  {name:"Curse",type:"text"},
  {name:"Timeline note",type:"long_text"},
] as const;

export const storyKey = (name:string) => name.trim().toLocaleLowerCase("en");
export function countMissingCharacters(existingTitles: readonly string[]) {
  const existing = new Set(existingTitles.map(storyKey));
  return FIRST_CHARACTERS.filter(c => !existing.has(storyKey(c.name))).length;
}
