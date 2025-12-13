"use client";

import React, { useMemo, useState } from "react";

type Rule = {
  selector: string;
  file: string;
  declarations?: string;
};

type ElementEntry = {
  sources: string[];
  rules: Rule[];
};

type RouteEntry = {
  route: string;
  stylesheets_in_order: string[];
  elements: Record<string, ElementEntry>;
};

// Support either top-level array OR { routes: [...] }
type Audit = RouteEntry[] | { routes: RouteEntry[] };

function getRoutes(audit: Audit): RouteEntry[] {
  return Array.isArray(audit) ? audit : audit.routes;
}

export default function CssAuditViewer({ audit }: { audit: Audit }) {
  const routes = useMemo(() => getRoutes(audit), [audit]);

  const [route, setRoute] = useState<string>(routes?.[0]?.route ?? "");
  const [element, setElement] = useState<string>("h1");
  const [filter, setFilter] = useState<string>("");

  const selected = useMemo(
    () => routes.find((r) => r.route === route),
    [routes, route]
  );

  const elementKeys = useMemo(() => {
    const keys = Object.keys(selected?.elements ?? {});
    keys.sort();
    return keys;
  }, [selected]);

  // Keep element selection valid when route changes
  const safeElement = useMemo(() => {
    if (!elementKeys.length) return element;
    return elementKeys.includes(element) ? element : elementKeys[0];
  }, [element, elementKeys]);

  const selectedElement = selected?.elements?.[safeElement];

  const filteredRules = useMemo(() => {
    const rules = selectedElement?.rules ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rules;

    return rules.filter((r) =>
      `${r.selector} ${r.file} ${r.declarations ?? ""}`.toLowerCase().includes(q)
    );
  }, [selectedElement, filter]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          Route{" "}
          <select value={route} onChange={(e) => setRoute(e.target.value)}>
            {routes.map((r) => (
              <option key={r.route} value={r.route}>
                {r.route}
              </option>
            ))}
          </select>
        </label>

        <label>
          Element{" "}
          <select
            value={safeElement}
            onChange={(e) => setElement(e.target.value)}
            disabled={!elementKeys.length}
          >
            {elementKeys.map((k) => (
              <option key={k} value={k}>
                {"<" + k + ">"}
              </option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 320px" }}>
          Filter{" "}
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search selector, file, declarations…"
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Stylesheets (in order)</h2>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          {(selected?.stylesheets_in_order ?? []).map((s, i) => (
            <li key={`${s}-${i}`}>
              <code>{s}</code>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>
          Rules for <code>{"<" + safeElement + ">"}</code>
        </h2>

        <div style={{ marginBottom: 10 }}>
          <strong>Sources:</strong>{" "}
          {(selectedElement?.sources ?? []).length ? (
            (selectedElement?.sources ?? []).map((s) => (
              <code key={s} style={{ marginRight: 8 }}>
                {s}
              </code>
            ))
          ) : (
            <span style={{ opacity: 0.7 }}>None found for this route</span>
          )}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {filteredRules.map((r, idx) => (
            <div key={idx} style={{ padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <code style={{ fontWeight: 600 }}>{r.selector}</code>
                <code style={{ opacity: 0.8 }}>{r.file}</code>
              </div>
              {r.declarations ? (
                <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{r.declarations}</pre>
              ) : null}
            </div>
          ))}

          {!filteredRules.length ? <div style={{ opacity: 0.7 }}>No matching rules.</div> : null}
        </div>
      </section>
    </div>
  );
}
