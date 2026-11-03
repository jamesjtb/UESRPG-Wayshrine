import { CreationKitLayout } from "../layouts/CreationKitLayout/CreationKitLayout";
import { AppProviders } from "./providers";
import { AppRoutes } from "./routes";
import type { ContentCatalogLoader } from "../lib/content/catalog";
import { ContentCatalogStatus } from "./ContentCatalogProvider";

export function App({ loadCatalog }: { loadCatalog: ContentCatalogLoader }) {
  return (
    <AppProviders loadCatalog={loadCatalog}>
      <CreationKitLayout>
        <ContentCatalogStatus />
        <AppRoutes />
      </CreationKitLayout>
    </AppProviders>
  );
}
