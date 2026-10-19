import {
  ActionIcon,
  AppShell,
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
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CreationKitNavigation } from "./CreationKitNavigation";

interface CreationKitLayoutProps {
  children: ReactNode;
}

export function CreationKitLayout({ children }: CreationKitLayoutProps) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure();
  const [collapsed, { toggle: toggleCollapsed }] = useDisclosure();
  const desktop = useMediaQuery("(min-width: 48em)");
  const location = useLocation();
  const collapseLabel = collapsed ? "Expand navigation" : "Collapse navigation";

  useEffect(() => {
    closeMobile();
  }, [location, closeMobile]);

  return (
    <AppShell
      header={{ height: 64 }}
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
          <Text fw={700}>Wayshrine Creation Kit</Text>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar
        p="sm"
        id="creation-kit-navigation"
        style={{ overflowY: "auto" }}
      >
        <Group
          justify={collapsed ? "center" : "space-between"}
          mb="sm"
          visibleFrom="sm"
        >
          {!collapsed && (
            <Text size="sm" fw={600}>
              Navigation
            </Text>
          )}
          <Tooltip label={collapseLabel} position="right">
            <ActionIcon
              variant="subtle"
              onClick={toggleCollapsed}
              aria-label={collapseLabel}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <IconLayoutSidebarLeftExpand size={20} />
              ) : (
                <IconLayoutSidebarLeftCollapse size={20} />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
        <CreationKitNavigation
          collapsed={collapsed && desktop}
          onNavigate={closeMobile}
        />
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
