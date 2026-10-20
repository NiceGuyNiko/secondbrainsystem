import {activeProfile, type Settings} from "./model";

// Staging-only, one-time account/profile appearance preference.
// Never touches production defaults, other profiles' non-colour settings,
// or changes the theme on subsequent logins after the user has chosen another.
export const stagingSlateKey=(userId:string)=>"aaa-staging-slate-v1:"+userId;

export function makeStagingSlate(settings:Settings):Settings{
 return {
  ...settings,
  profiles:settings.profiles.map(profile=>({
   ...profile,
   preferences:{
    ...profile.preferences,
    themeMode:"manual" as const,
    appearance:{
     ...profile.preferences.appearance,
     preset:"slate",
     primaryAccentOverride:null,
     highlightAccentOverride:null,
    },
   },
  })),
 };
}

export function isStagingSlateReady(settings:Settings){
 return activeProfile(settings).preferences.appearance.preset==="slate";
}
