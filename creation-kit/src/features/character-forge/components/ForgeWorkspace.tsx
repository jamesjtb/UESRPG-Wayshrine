import { Paper, Stack } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./ForgeWorkspace.module.css";

interface ForgeWorkspaceProps {
  editor: ReactNode;
  navigation: ReactNode;
  sheet: ReactNode;
}

export function ForgeWorkspace({
  editor,
  navigation,
  sheet,
}: ForgeWorkspaceProps) {
  return (
    <div className={classes.panes}>
      <Paper
        component="section"
        aria-label="Character sheet"
        tabIndex={0}
        withBorder
        p="md"
        className={`${classes.pane} ${classes.sheet}`}
      >
        {sheet}
      </Paper>
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
    </div>
  );
}
