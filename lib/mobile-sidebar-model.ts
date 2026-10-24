export type MobileSidebarMode="subpages"|"pages"|"split";

/** Tapping the current page heading alternates between its subpages and all pages. */
export function toggleMobileSidebarMode(mode:MobileSidebarMode):MobileSidebarMode{
  return mode==="pages"?"subpages":"pages";
}

/** A genuine divider gesture can expose both independently scrollable lists. */
export function modeForMobileSidebarDivider(percent:number):MobileSidebarMode{
  if(percent<=16)return "subpages";
  if(percent>=80)return "pages";
  return "split";
}

/** Selecting any page, including the current one, shows that page's subheadings. */
export function modeAfterSidebarPageSelection():MobileSidebarMode{return "subpages";}
