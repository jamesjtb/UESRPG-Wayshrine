import "@mantine/core/styles.css";

import { Button, MantineProvider, Stack, Text, Title } from "@mantine/core";
import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { CreationKitLayout } from "./CreationKitLayout";

export function App() {
  return (
    <MantineProvider>
      <HashRouter>
        <CreationKitLayout>
          <Routes>
            <Route
              path="/"
              element={
                <Stack>
                  <Title order={1}>Welcome to Wayshrine Creation Kit</Title>
                  <Text>
                    Game preparation tools for UESRPG players and GMs.
                  </Text>
                  <Text c="dimmed">
                    This project is a work in progress. No tools are available
                    yet.
                  </Text>
                </Stack>
              }
            />
            <Route
              path="*"
              element={
                <Stack align="flex-start">
                  <Title order={1}>Page not found</Title>
                  <Text>This page does not exist or is not available yet.</Text>
                  <Button component={Link} to="/">
                    Return home
                  </Button>
                </Stack>
              }
            />
          </Routes>
        </CreationKitLayout>
      </HashRouter>
    </MantineProvider>
  );
}
