"use client";
import {Component,type ErrorInfo,type ReactNode} from "react";

type Props={children:ReactNode};
type State={failed:boolean;message:string};
export default class DatabaseLabErrorBoundary extends Component<Props,State>{
 state:State={failed:false,message:""};
 static getDerivedStateFromError(error:Error):State{
  return {failed:true,message:error.message||"An unexpected client error occurred."};
 }
 componentDidCatch(error:Error,info:ErrorInfo){
  console.error("[database-lab] rendering failed",error,info.componentStack);
 }
 render(){
  if(!this.state.failed)return this.props.children;
  return <main role="alert" className="db-lab-disabled" style={{maxWidth:680,margin:"8vh auto"}}>
   <h1>Database Lab encountered an error</h1>
   <p>Your data remains saved in staging Supabase. The database interface could not finish loading.</p>
   <details><summary>Technical details</summary><pre style={{overflowWrap:"anywhere",whiteSpace:"pre-wrap"}}>
    {this.state.message}
   </pre></details>
   <button type="button" style={{marginTop:16,padding:"9px 16px"}}
    onClick={()=>this.setState({failed:false,message:""})}>Try loading again</button>
   <button type="button" style={{margin:"16px 8px",padding:"9px 16px"}}
    onClick={()=>window.location.reload()}>Reload page</button>
  </main>;
 }
}
