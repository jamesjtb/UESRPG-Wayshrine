import { Button, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Stack align="flex-start">
      <Title order={1}>Page not found</Title>
      <Text>This page does not exist or is not available yet.</Text>
      <Button component={Link} to="/">
        Return home
      </Button>
    </Stack>
  );
}
