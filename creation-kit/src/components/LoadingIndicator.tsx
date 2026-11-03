import { Box, Loader } from "@mantine/core";

export function LoadingIndicator({ label }: { label: string }) {
  return (
    <Box role="status" aria-label={label}>
      <Loader size="sm" aria-hidden="true" />
    </Box>
  );
}
