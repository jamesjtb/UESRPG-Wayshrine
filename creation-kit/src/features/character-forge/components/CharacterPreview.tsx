import { List, Stack, Text, TextInput, Title } from "@mantine/core";
import type { CharacterCreator } from "@wayshrine/core";
import { SkillRank } from "@wayshrine/core";
import { plainDescription, readableLabel } from "../labels";

type Preview = ReturnType<CharacterCreator["getCharacterPreview"]>;

function traitParameters(
  params: Readonly<Record<string, string | number>> | undefined,
) {
  if (!params) return "";
  const entries = Object.entries(params).map(
    ([key, value]) => `${readableLabel(key)}: ${value}`,
  );
  return ` (${entries.join(", ")})`;
}

export function CharacterPreview({
  preview,
  raceLabel,
  onNameChange,
}: {
  preview: Preview;
  raceLabel?: string;
  onNameChange: (name: string) => void;
}) {
  const race = preview.race;
  const description = plainDescription(race?.description ?? "");
  // Core initializes unused characteristics to zero. Show supplied baselines,
  // without deriving rolled/final scores or relying on race-owned field lists.
  const characteristics = Object.values(preview.characteristics).filter(
    (value) => value.baseline !== 0,
  );
  return (
    <Stack>
      <TextInput
        aria-label="Character name"
        placeholder="Unnamed Character"
        size="xl"
        styles={{ input: { fontWeight: 700 } }}
        value={preview.name}
        onChange={(event) => onNameChange(event.currentTarget.value)}
      />
      <Title order={3}>Race</Title>
      {!race && <Text>No race selected.</Text>}
      {race && (
        <Text>{raceLabel ?? readableLabel("Selected race", race.label)}</Text>
      )}
      {description && <Text>{description}</Text>}
      <Title order={3}>Characteristics</Title>
      {characteristics.length === 0 && <Text>No characteristics.</Text>}
      <List>
        {characteristics.map((value) => (
          <List.Item key={value.characteristicKey}>
            {readableLabel(value.characteristicKey)}: {value.baseline}
          </List.Item>
        ))}
      </List>
      <Title order={3}>Traits</Title>
      {preview.traits.length === 0 && <Text>No traits.</Text>}
      <List>
        {preview.traits.map((trait, index) => (
          <List.Item key={`${trait.traitKey}/${index}`}>
            {readableLabel(trait.traitKey)}
            {traitParameters(trait.params)}
          </List.Item>
        ))}
      </List>
      <Title order={3}>Skills</Title>
      {preview.skills.length === 0 && <Text>No skills.</Text>}
      <List>
        {preview.skills.map(({ skill, skillRank }) => (
          <List.Item key={skill.skillKey}>
            {readableLabel(skill.skillKey, skill.label)} ({SkillRank[skillRank]}
            )
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
