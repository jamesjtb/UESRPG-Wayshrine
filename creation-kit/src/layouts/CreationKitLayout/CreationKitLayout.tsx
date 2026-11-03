import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Group,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CreationKitNavigation } from "./CreationKitNavigation";
import { ToolHeaderContext } from "./ToolHeader";
import classes from "./CreationKitLayout.module.css";

interface CreationKitLayoutProps {
  children: ReactNode;
}

export function CreationKitLayout({ children }: CreationKitLayoutProps) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure();
  const [collapsed, { toggle: toggleCollapsed }] = useDisclosure();
  const desktop = useMediaQuery("(min-width: 48em)");
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const compact = collapsed && desktop;
  const location = useLocation();
  const collapseLabel = collapsed ? "Expand navigation" : "Collapse navigation";

  useEffect(() => {
    closeMobile();
  }, [location, closeMobile]);

  return (
    <AppShell
      layout="alt"
      header={{ height: 56 }}
      navbar={{
        width: collapsed ? 80 : 300,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" wrap="nowrap">
          <Burger
            opened={mobileOpened}
            onClick={toggleMobile}
            hiddenFrom="sm"
            size="sm"
            aria-label={mobileOpened ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpened}
            aria-controls="creation-kit-navigation"
          />
          <Box
            ref={setHeaderTarget}
            style={{ flex: 1, minWidth: 0, overflowX: "auto" }}
          />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar
        p="sm"
        id="creation-kit-navigation"
        style={{ overflowY: "auto" }}
      >
        <Group justify={compact ? "center" : "space-between"} mb="sm">
          {compact ? (
            <Tooltip label="Wayshrine Creation Kit" position="right">
              <Text fw={700} aria-label="Wayshrine Creation Kit">
                W
              </Text>
            </Tooltip>
          ) : (
            <Text fw={700}>Wayshrine Creation Kit</Text>
          )}
          <Tooltip label={collapseLabel} position="right">
            <ActionIcon
              variant="subtle"
              onClick={toggleCollapsed}
              aria-label={collapseLabel}
              aria-expanded={!collapsed}
              visibleFrom="sm"
            >
              {collapsed ? (
                <IconLayoutSidebarLeftExpand size={20} />
              ) : (
                <IconLayoutSidebarLeftCollapse size={20} />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
        <CreationKitNavigation collapsed={compact} onNavigate={closeMobile} />
      </AppShell.Navbar>
      <AppShell.Main
        className={
          location.pathname === "/character-forge"
            ? classes.forgeWorkspace
            : undefined
        }
      >
        <ToolHeaderContext.Provider value={headerTarget}>
          {children}
        </ToolHeaderContext.Provider>
      </AppShell.Main>
    </AppShell>
  );
}
