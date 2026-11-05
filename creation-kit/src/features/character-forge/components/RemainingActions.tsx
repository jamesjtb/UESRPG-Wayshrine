import { Accordion, Badge, Paper } from "@mantine/core";
import { useState } from "react";
import classes from "./RemainingActions.module.css";

type RemainingActionsProps = {
  actions: readonly { id: string; label: string }[];
};

export function RemainingActions({ actions }: RemainingActionsProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const firstAction = actions[0];

  if (!firstAction) return null;

  if (actions.length === 1) {
    return (
      <Paper className={classes.frame}>
        <div className={classes.single}>{firstAction.label}</div>
      </Paper>
    );
  }

  return (
    <Accordion
      className={classes.frame}
      classNames={{
        item: classes.item,
        control: classes.control,
        label: classes.label,
        content: classes.content,
      }}
      value={expandedItem}
      onChange={setExpandedItem}
    >
      <Accordion.Item value="remaining-actions">
        <Accordion.Control>
          <span className={classes.summary}>
            <span className={classes.summaryText}>
              {expandedItem ? "Before you continue" : firstAction.label}
            </span>{" "}
            <Badge
              component="span"
              size="xs"
              variant="light"
              color="gray"
              tt="none"
            >
              {actions.length} remaining
            </Badge>
          </span>
        </Accordion.Control>
        <Accordion.Panel>
          <ul className={classes.list}>
            {actions.map((action) => (
              <li key={action.id}>{action.label}</li>
            ))}
          </ul>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
