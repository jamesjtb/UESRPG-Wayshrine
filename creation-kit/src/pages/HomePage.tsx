import { Stack, Text, Title } from "@mantine/core";

export function HomePage() {
  return (
    <Stack>
      <Title order={1}>Welcome to Wayshrine Creation Kit</Title>
      <Text>Game preparation tools for UESRPG players and GMs.</Text>
      <Text c="dimmed">
        This project is a work in progress. No tools are available yet.
      </Text>
    </Stack>
  );
}
