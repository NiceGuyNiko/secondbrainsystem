/**
 * Mobile tooltip interaction is profile-scoped. Desktop hover help is always
 * available regardless of this preference.
 */
export const MOBILE_TOOLTIP_MODES=["off","tap","hold"] as const;
export type MobileTooltipMode=typeof MOBILE_TOOLTIP_MODES[number];
export const DEFAULT_MOBILE_TOOLTIP_MODE:MobileTooltipMode="hold";

export function parseMobileTooltipMode(
  value:unknown,fallback:MobileTooltipMode=DEFAULT_MOBILE_TOOLTIP_MODE
):MobileTooltipMode{
  return value==="off"||value==="tap"||value==="hold"?value:fallback;
}
export function mobileGestureShowsTooltip(
  mode:MobileTooltipMode,gesture:"tap"|"hold"
):boolean{
  return mode!=="off"&&mode===gesture;
}
