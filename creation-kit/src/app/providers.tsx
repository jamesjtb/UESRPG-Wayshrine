import "@mantine/core/styles.css";

import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { HashRouter } from "react-router-dom";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <MantineProvider>
      <HashRouter>{children}</HashRouter>
    </MantineProvider>
  );
}
