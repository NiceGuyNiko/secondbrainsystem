// Ontario ESA public holidays and commonly recognized observances.
// Sources: ontario.ca/document/your-guide-employment-standards-act-0/public-holidays
// and ontario.ca/document/employment-standard-act-policy-and-interpretation-manual/part-i-definitions
export type Holiday = { id: string; title: string; date: string; classification: "Ontario public holiday" | "Observance" | "Common observed date"; note: string };
const key = (d: Date) => d.toISOString().slice(0, 10);
const day = (y: number, m: number, d: number) => new Date(Date.UTC(y,m-1,d,12));
const shift = (d: Date, n: number) => new Date(d.getTime()+n*86400000);
const nth = (y:number,m:number,weekday:number,n:number) => {const d=day(y,m,1);return shift(d,(weekday-d.getUTCDay()+7)%7+(n-1)*7)};
export function easter(y:number) {
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
  return day(y,Math.floor(n/31),n%31+1);
}
export function ontarioHolidays(y:number):Holiday[] {
  const out:Holiday[]=[];
  const add=(title:string,date:Date,publicHoliday=false,note="")=>out.push({id:"on-"+key(date)+"-"+title.toLowerCase().replace(/[^a-z0-9]+/g,"-"),title,date:key(date),classification:publicHoliday?"Ontario public holiday":"Observance",note});
  const fixed:[string,number,number,boolean][]=[
    ["New Year's Day",1,1,true],["Valentine's Day",2,14,false],["St. Patrick's Day",3,17,false],
    ["Canada Day",7,1,true],["National Day for Truth and Reconciliation",9,30,false],
    ["Halloween",10,31,false],["Remembrance Day",11,11,false],["Christmas Eve",12,24,false],
    ["Christmas Day",12,25,true],["Boxing Day",12,26,true],["New Year's Eve",12,31,false]];
  fixed.forEach(([t,m,d,s])=>add(t,day(y,m,d),s));
  add("Family Day",nth(y,2,1,3),true);
  add("Good Friday",shift(easter(y),-2),true);add("Easter Sunday",easter(y));add("Easter Monday",shift(easter(y),1));
  add("Mother's Day",nth(y,5,0,2));add("Father's Day",nth(y,6,0,3));
  const may25=day(y,5,25);add("Victoria Day",shift(may25,-((may25.getUTCDay()+6)%7||7)),true);
  add("Civic Holiday",nth(y,8,1,1));add("Labour Day",nth(y,9,1,1),true);add("Thanksgiving Day",nth(y,10,1,2),true);
  // Common Monday-Friday office observance, NOT an employee's guaranteed ESA substitute day.
  const occupied=new Set(out.filter(h=>h.classification==="Ontario public holiday").map(h=>h.date));
  for(const h of [...out].filter(h=>h.classification==="Ontario public holiday")) {
    const actual=new Date(h.date+"T12:00:00Z");
    if(actual.getUTCDay()!==0&&actual.getUTCDay()!==6)continue;
    let observed=shift(actual,1);
    while([0,6].includes(observed.getUTCDay())||occupied.has(key(observed)))observed=shift(observed,1);
    occupied.add(key(observed));
    out.push({...h,id:h.id+"-observed",title:h.title+" (observed)",date:key(observed),classification:"Common observed date",note:"Common weekday observance. Ontario ESA substitute days depend on the employee's schedule and agreement; confirm with your employer."});
    if(h.title==="Canada Day"&&actual.getUTCDay()===0){
      h.classification="Observance";
      h.note="Celebration date; the public holiday is July 2 this year under the federal Holidays Act.";
      out[out.length-1].classification="Ontario public holiday";
      out[out.length-1].note="Canada Day falls on July 2 under the federal Holidays Act when July 1 is Sunday.";
    }
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
