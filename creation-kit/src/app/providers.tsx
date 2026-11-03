import "@mantine/core/styles.css";

import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { HashRouter } from "react-router-dom";
import { ContentCatalogProvider } from "./ContentCatalogProvider";
import type { ContentCatalogLoader } from "../lib/content/catalog";

interface AppProvidersProps {
  children: ReactNode;
  loadCatalog: ContentCatalogLoader;
}

export function AppProviders({ children, loadCatalog }: AppProvidersProps) {
  return (
    <MantineProvider>
      <ContentCatalogProvider loadCatalog={loadCatalog}>
        <HashRouter>{children}</HashRouter>
      </ContentCatalogProvider>
    </MantineProvider>
  );
}
