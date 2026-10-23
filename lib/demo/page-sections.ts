// Friendly starter sections for the isolated design preview. Users can rename and reorder them.
const titles:Record<string,string[]>={
  "World View":["World History","Story Moments & Perspectives"],
  "Character Atlas":["Characters","Character Perspectives"],
  "Book One Studio":["Scenes & Moments","Project Progress"],
  "Goals Overview":["Vision & Outcomes","Projects & Next Actions"]
};
export function demoPageSectionTitles(pageTitle:string):string[]{
  return titles[pageTitle]??["Overview"];
}
export function demoPageSectionIndex(pageTitle:string,widgetIndex:number):number{
  return pageTitle==="Character Atlas"?widgetIndex:Math.floor(widgetIndex/2);
}
