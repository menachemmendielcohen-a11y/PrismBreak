import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import PrismBreak from "../../app/PrismBreak";

declare global {
  interface Window {
    __PRISM_STATIC_BUILD__?: boolean;
  }
}

window.__PRISM_STATIC_BUILD__ = true;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing game root element");

createRoot(rootElement).render(
  <StrictMode>
    <PrismBreak />
  </StrictMode>,
);
