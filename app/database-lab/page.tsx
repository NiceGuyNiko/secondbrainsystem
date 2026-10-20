import Link from "next/link";
import { environment } from "@/lib/environment";
import AuthGate from "@/components/auth-gate";
import DatabaseEngineLab from "@/components/database-engine-lab";
import StagingDatabaseLab from "@/components/database-staging-lab";
import StagingLabTheme from "@/components/staging-lab-theme";
import "./lab.css";

export default function DatabaseLabPage() {
  if (!environment.ok || !["demo","staging"].includes(environment.data)) {
    return <main className="db-lab-disabled">
      <h1>Database Lab is staging-only</h1>
      <p>This isolated acceptance environment never connects to production Supabase.</p>
      <Link href="/">Return to All About Action</Link>
    </main>;
  }
  if(environment.data === "staging") return <StagingLabTheme><AuthGate><StagingDatabaseLab/></AuthGate></StagingLabTheme>;
  return <DatabaseEngineLab />;
}
