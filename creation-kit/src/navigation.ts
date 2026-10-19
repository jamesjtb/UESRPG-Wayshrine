import {
  IconFlask,
  IconHome,
  IconPackage,
  IconSparkles,
  IconUser,
  IconUsers,
  IconWand,
} from "@tabler/icons-react";

export const navigationItems = [
  { label: "Home", path: "/", icon: IconHome, available: true },
  {
    label: "Character Forge",
    path: "/character-forge",
    icon: IconUser,
    available: false,
  },
  {
    label: "NPC Profile Editor",
    path: "/npc-profile-editor",
    icon: IconUsers,
    available: false,
  },
  {
    label: "Unconventional Spell Creator",
    path: "/unconventional-spell-creator",
    icon: IconWand,
    available: false,
  },
  {
    label: "Enchantment Creator",
    path: "/enchantment-creator",
    icon: IconSparkles,
    available: false,
  },
  {
    label: "Alchemist Workflows",
    path: "/alchemist-workflows",
    icon: IconFlask,
    available: false,
  },
  {
    label: "Loot Generator",
    path: "/loot-generator",
    icon: IconPackage,
    available: false,
  },
] as const;
