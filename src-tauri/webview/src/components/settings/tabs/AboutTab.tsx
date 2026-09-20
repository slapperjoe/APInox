/**
 * AboutTab.tsx
 *
 * App identity: version + tech stack. Version comes from the __APP_VERSION__
 * build-time global (defined in vite.config.ts and vitest.config.ts), so no
 * Tauri getVersion() round-trip is needed.
 */
import React from "react";
import { ScrollableForm, SectionHeader } from "./SettingsTypes";

declare const __APP_VERSION__: string;

export const AboutTab: React.FC = () => {
  return (
    <ScrollableForm>
      <SectionHeader style={{ marginTop: 0 }}>About</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: 480 }}>
        <div>
          <span style={{ color: "var(--apinox-descriptionForeground)" }}>Version </span>
          <strong>{typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown"}</strong>
        </div>
        <div>
          <span style={{ color: "var(--apinox-descriptionForeground)" }}>Stack </span>
          <span>Tauri 2 · Rust · React</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "var(--apinox-fs-sm)", color: "var(--apinox-descriptionForeground)" }}>
          Built-in HTTP/HTTPS proxy and mock server for SOAP API testing and debugging.
        </p>
      </div>
    </ScrollableForm>
  );
};
