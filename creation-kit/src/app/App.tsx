import { CreationKitLayout } from "../layouts/CreationKitLayout/CreationKitLayout";
import { AppProviders } from "./providers";
import { AppRoutes } from "./routes";

export function App() {
  return (
    <AppProviders>
      <CreationKitLayout>
        <AppRoutes />
      </CreationKitLayout>
    </AppProviders>
  );
}
