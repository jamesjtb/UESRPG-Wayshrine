import { Stack, Text, Title } from "@mantine/core";

export function HomePage() {
    return (
        <Stack>
            <Title order={1}>Welcome to Wayshrine Creation Kit</Title>
            <Text>Game preparation tools for UESRPG players and GMs.</Text>
            <Text c="dimmed">
                Select an available tool in the navigation pane on the left to continue.
            </Text>
        </Stack>
    );
}
