import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { createContentCatalogLoader } from "./lib/content/catalog";

const loadCatalog = createContentCatalogLoader();

const root = document.getElementById("root");

if (!root) {
  throw new Error("The Creation Kit root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <App loadCatalog={loadCatalog} />
  </StrictMode>,
);
