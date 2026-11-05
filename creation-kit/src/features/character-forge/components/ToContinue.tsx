import { Accordion, Badge, Paper } from "@mantine/core";
import { IconAlertTriangle, IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";
import { LoadingIndicator } from "../../../components/LoadingIndicator";
import classes from "./ToContinue.module.css";

export type UserAction = {
  id: string;
  label: string;
  loading?: boolean;
};

type ToContinueProps = {
  actions: readonly UserAction[];
};

function ActionLabel({ action }: { action: UserAction }) {
  if (action.loading) return <LoadingIndicator label={action.label} />;
  return <span>{action.label}</span>;
}

export function ToContinue({ actions }: ToContinueProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const firstAction = actions[0];

  if (!firstAction) return null;

  if (actions.length === 1) {
    return (
      <Paper className={classes.frame}>
        <div className={classes.single}>
          <IconAlertTriangle
            size={18}
            className={classes.warningIcon}
            aria-hidden
          />
          <ActionLabel action={firstAction} />
        </div>
      </Paper>
    );
  }

  return (
    <Accordion
      className={classes.frame}
      chevronPosition="right"
      chevronSize={28}
      chevron={<IconChevronDown size={18} aria-hidden />}
      classNames={{
        item: classes.item,
        control: classes.control,
        label: classes.label,
        content: classes.content,
        chevron: classes.chevron,
      }}
      value={expandedItem}
      onChange={setExpandedItem}
    >
      <Accordion.Item value="to-continue">
        <Accordion.Control
          icon={
            <IconAlertTriangle
              size={18}
              className={classes.warningIcon}
              aria-hidden
            />
          }
        >
          <span className={classes.summary}>
            <span className={classes.summaryText}>
              {expandedItem ? (
                "Complete the following to continue"
              ) : (
                <ActionLabel action={firstAction} />
              )}
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
              <li key={action.id}>
                <ActionLabel action={action} />
              </li>
            ))}
          </ul>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
