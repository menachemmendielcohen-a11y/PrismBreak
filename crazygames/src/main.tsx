import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import PrismBreak from "../../app/PrismBreak";
import { isCrazyGamesLaunchAllowed } from "./sitelock.js";

declare global {
  interface Window {
    __PRISM_STATIC_BUILD__?: boolean;
  }
}

window.__PRISM_STATIC_BUILD__ = true;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing game root element");

const root = createRoot(rootElement);
const launchAllowed = isCrazyGamesLaunchAllowed();

if (!launchAllowed) {
  root.render(
    <main
      role="status"
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        margin: 0,
        background: "#020309",
        color: "#fff",
        font: "16px sans-serif",
      }}
    >
      Available only on CrazyGames
    </main>,
  );
} else {
  root.render(
    <StrictMode>
      <PrismBreak />
    </StrictMode>,
  );
}
