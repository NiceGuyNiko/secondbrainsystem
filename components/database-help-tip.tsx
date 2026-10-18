"use client";
import { HelpCircle } from "lucide-react";

export default function HelpTip({ subject, children }: { subject: string; children: string }) {
  return <span className="aaa-db-help-wrap">
    <button type="button" className="aaa-db-help" aria-label={"What does "+subject+" mean?"} aria-describedby={undefined} title={subject+": "+children}><HelpCircle size={15}/></button>
    <span className="aaa-db-help-text" role="tooltip"><strong>{subject}</strong>{children}</span>
  </span>;
}
