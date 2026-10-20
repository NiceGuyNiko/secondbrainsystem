/**
 * Fail-closed activation of the generic database engine.
 * We use a final, authenticated SQL marker rather than assuming an early
 * db_* table proves that every relation, RPC, RLS policy and migration exists.
 */
export type DatabaseEngineState="checking"|"ready"|"missing"|"error";
export type EngineProbeError={code?:string;message:string};
export function classifyDatabaseEngineProbe(
  data:boolean|null|undefined,
  error:EngineProbeError|null|undefined,
):Exclude<DatabaseEngineState,"checking"> {
 if(!error)return data===true?"ready":"missing";
 if((error.code==="PGRST202"||error.code==="42883"||error.code==="PGRST205")&&
    /db_engine_ready/i.test(error.message))return "missing";
 return "error";
}
