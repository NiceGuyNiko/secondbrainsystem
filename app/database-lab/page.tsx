import Link from "next/link";
import { environment } from "@/lib/environment";
import DatabaseEngineLab from "@/components/database-engine-lab";
import "./lab.css";

export default function DatabaseLabPage() {
  if (!environment.ok || environment.data !== "demo") {
    return <main className="db-lab-disabled">
      <h1>Database Lab is preview-only</h1>
      <p>This isolated acceptance environment is only enabled for Demo Mode. It never connects to production Supabase.</p>
      <Link href="/">Return to All About Action</Link>
    </main>;
  }
  return <DatabaseEngineLab />;
}
