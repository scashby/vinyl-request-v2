// src/app/not-found.js
"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function NotFound() {
  useEffect(() => {
    console.log("Custom 404 loaded at", window.location.pathname);
  }, []);
  return (
    <div style={{ color: "red", padding: 40 }}>
      <h1>404: Page Not Found</h1>
      <p>
        This route does not exist or failed to build.
        <br />
        <Link href="/">Go home</Link>
      </p>
    </div>
  );
}
// AUDIT: inspected, no changes.
