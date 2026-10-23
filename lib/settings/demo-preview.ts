import type {Settings} from "./model";

// One-time defaults for the isolated, password-free developer preview.
// Never run against staging or production profiles and never overwrite later choices.
export const demoWidgetPreviewKey="aaa-demo-widgets-darkest-night-v1";
export function makeDemoWidgetPreview(settings:Settings):Settings{
  return {...settings,account:{...settings.account,developerMode:true},profiles:settings.profiles.map(profile=>({
    ...profile,preferences:{...profile.preferences,widgetStyle:"studio" as const,appearance:{
      ...profile.preferences.appearance,preset:"darkest-night",primaryAccentOverride:null,highlightAccentOverride:null
    }}
  }))};
}
