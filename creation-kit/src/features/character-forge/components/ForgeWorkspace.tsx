import { Paper, SimpleGrid, Stack } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./ForgeWorkspace.module.css";

interface ForgeWorkspaceProps {
  editor: ReactNode;
  navigation: ReactNode;
  preview: ReactNode;
}

export function ForgeWorkspace({
  editor,
  navigation,
  preview,
}: ForgeWorkspaceProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} className={classes.panes}>
      <Paper
        component="section"
        aria-label="Character editor"
        withBorder
        p="md"
        className={classes.pane}
      >
        <Stack gap={0} className={classes.editorBody}>
          {editor}
        </Stack>
        <Stack component="footer" className={classes.footer} pt="md">
          {navigation}
        </Stack>
      </Paper>
      <Paper
        component="section"
        aria-label="Character sheet"
        tabIndex={0}
        withBorder
        p="md"
        className={`${classes.pane} ${classes.sheet}`}
      >
        {preview}
      </Paper>
    </SimpleGrid>
  );
}
