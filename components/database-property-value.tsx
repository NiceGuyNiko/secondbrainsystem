import {formatDatabasePropertyValue,numberFormatOf,percentageValue,type DatabaseDisplayProperty} from "@/lib/db-property-format";

export default function DatabasePropertyValue({property,value}:{property:DatabaseDisplayProperty;value:unknown}){
  const formatted=formatDatabasePropertyValue(property,value);
  if(property.type==="number"&&numberFormatOf(property)==="bar"){
    const progress=percentageValue(value);
    if(progress!==null)return <span className="aaa-property-progress" role="progressbar" aria-label={property.name??property.label??"Progress"}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <span className="aaa-property-progress-track"><span style={{width:progress+"%"}}/></span>
      <span className="aaa-property-progress-label">{formatted}</span>
    </span>;
  }
  return <>{formatted}</>;
}
