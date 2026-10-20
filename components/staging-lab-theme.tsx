"use client";
import {useLayoutEffect,type ReactNode} from "react";
import {appearanceDefaults,applyAppearance} from "@/lib/appearance";
import {updateFavicon} from "@/lib/favicon";

// This laboratory doesn't mount Workspace/useSettings. Match the staging
// account's chosen starting appearance on direct visits and sign-in.
// Production themes and the user's profiles are not modified here.
export default function StagingLabTheme({children}:{children:ReactNode}){
 useLayoutEffect(()=>{
  const tokens=applyAppearance({...appearanceDefaults,preset:"slate"});
  void updateFavicon(tokens);
 },[]);
 return <>{children}</>;
}
