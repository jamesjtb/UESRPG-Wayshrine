import type { Birthsign } from "../character/Birthsign";
import type { Race } from "../character/Race";
import type Skill from "../character/Skill";
import type { Trait } from "../character/Trait";

/** YAML skills use their enclosing map key; hosts may already have supplied it. */
type AuthoredSkillVariant<T> = T extends Skill
  ? Omit<T, "skillKey"> & {
      skillKey?: string;
      label: string;
      description: string;
    }
  : never;

/** Authoring domains are deliberately separate from runtime ContentKind. */
export interface AuthoredDefinitions {
  races: Race;
  traits: Trait;
  skills: AuthoredSkillVariant<Skill>;
  birthsigns: Birthsign;
}

export type AuthoredDomain = keyof AuthoredDefinitions;
export type AuthoredContent = {
  [D in AuthoredDomain]: Record<string, AuthoredDefinitions[D]>;
};
