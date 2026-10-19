import { Box, NavLink, Stack, Tooltip } from "@mantine/core";
import { Link, useLocation } from "react-router-dom";
import { navigationItems } from "./navigation";

interface CreationKitNavigationProps {
  collapsed: boolean;
  onNavigate: () => void;
}

export function CreationKitNavigation({
  collapsed,
  onNavigate,
}: CreationKitNavigationProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Creation Kit">
      <Stack gap="xs">
        {navigationItems.map(({ label, path, icon: Icon, available }) => {
          const active = available && pathname === path;
          const content = collapsed ? (
            <Icon size={22} aria-hidden="true" />
          ) : (
            label
          );
          const sharedProps = {
            label: content,
            leftSection: collapsed ? undefined : (
              <Icon size={20} aria-hidden="true" />
            ),
            "aria-label": label,
            active,
            styles: {
              root: {
                borderRadius: "var(--mantine-radius-sm)",
                justifyContent: collapsed ? "center" : undefined,
              },
              body: { flex: collapsed ? "0 0 auto" : undefined },
            },
          };

          return (
            <Tooltip
              key={path}
              label={label}
              position="right"
              disabled={!collapsed}
            >
              <Box>
                {available ? (
                  <NavLink
                    {...sharedProps}
                    component={Link}
                    to={path}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                  />
                ) : (
                  <NavLink
                    {...sharedProps}
                    disabled
                    renderRoot={(props) => (
                      <button {...props} type="button" disabled />
                    )}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
    </nav>
  );
}
