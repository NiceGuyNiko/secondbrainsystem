/**
 * Canonical database property display only. Stored values remain unchanged, so
 * sorting, formula calculations and relations still consume raw values.
 * Progress is a 0–100 numeric value (65 means 65%, not 0.65).
 */
export type DatabaseDisplayProperty={
  type:string;name?:string;label?:string;
  config?:{
    numberFormat?:unknown;decimalPlaces?:unknown;currencyCode?:unknown;
    dateFormat?:unknown;checkboxFormat?:unknown;
  };
};
export type NumberDisplayFormat="number"|"percent"|"bar"|"currency";
export const NUMBER_DISPLAY_OPTIONS=[
  {value:"number",label:"Number"},
  {value:"percent",label:"Percentage (%)"},
  {value:"bar",label:"Progress bar + %"},
  {value:"currency",label:"Currency"}
] as const;
export function numberFormatOf(prop:DatabaseDisplayProperty):NumberDisplayFormat{
  const raw=prop.config?.numberFormat;
  if(raw==="number"||raw==="percent"||raw==="bar"||raw==="currency")return raw;
  // Legacy demo fields called Progress were always stored as 0–100 numbers.
  return /progress|completion/i.test(prop.name??prop.label??"")?"percent":"number";
}
export function displayDecimals(prop:DatabaseDisplayProperty){
  const raw=prop.config?.decimalPlaces;
  return typeof raw==="number"&&Number.isInteger(raw)&&raw>=0&&raw<=3?raw:0;
}
export function percentageValue(raw:unknown):number|null{
  if(raw===null||raw===undefined||raw==="")return null;
  const n=typeof raw==="number"?raw:Number(raw);
  return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;
}
export function formatDatabasePropertyValue(prop:DatabaseDisplayProperty,value:unknown):string{
  if(value===null||value===undefined||value==="")return "—";
  if(Array.isArray(value))return value.join(", ")||"—";
  if(prop.type==="checkbox"){
    const mode=prop.config?.checkboxFormat;
    const checked=value===true||value==="true";
    if(mode==="done")return checked?"Done":"Not done";
    if(mode==="icon")return checked?"✓":"○";
    return checked?"Yes":"No";
  }
  if(prop.type==="date"){
    const text=String(value);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return text;
    const mode=prop.config?.dateFormat;
    if(mode!=="short"&&mode!=="long")return text;
    const date=new Date(text+"T12:00:00Z");
    if(Number.isNaN(date.getTime()))return text;
    return new Intl.DateTimeFormat("en-CA",{timeZone:"UTC",year:"numeric",
      month:mode==="short"?"short":"long",day:"numeric"}).format(date);
  }
  if(prop.type==="number"){
    const valueNumber=typeof value==="number"?value:Number(value);
    if(!Number.isFinite(valueNumber))return String(value);
    const decimals=displayDecimals(prop);
    const number=new Intl.NumberFormat("en-CA",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
    const mode=numberFormatOf(prop);
    if(mode==="currency"){
      const raw=prop.config?.currencyCode;
      const code=typeof raw==="string"&&/^[A-Z]{3}$/.test(raw)?raw:"CAD";
      try{return new Intl.NumberFormat("en-CA",{style:"currency",currency:code,
        minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(valueNumber)}
      catch{return number.format(valueNumber)}
    }
    return number.format(valueNumber)+(mode==="percent"||mode==="bar"?"%":"");
  }
  return String(value);
}
