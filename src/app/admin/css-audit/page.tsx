import fs from "node:fs/promises";
import path from "node:path";
import CssAuditViewer from "./viewer";

export default async function CssAuditPage() {
  const auditPath = path.join(process.cwd(), "src", "audits", "css", "route-style-element-map.json");
  const raw = await fs.readFile(auditPath, "utf-8");
  const audit = JSON.parse(raw);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>CSS Audit Dashboard</h1>
      <p style={{ marginBottom: 18, opacity: 0.8 }}>
        Route → stylesheets (order) → element rules and their sources.
      </p>

      <CssAuditViewer audit={audit} />
    </main>
  );
}
