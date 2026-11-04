import {
  Badge,
  List,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import type { CharacterCreator } from "@wayshrine/core";
import { SkillRank } from "@wayshrine/core";
import { plainDescription, readableLabel } from "../labels";
import { characteristicLabels } from "../steps/characteristics/characteristicLabels";

const previewCharacteristicLabels = { ...characteristicLabels, lck: "Luck" };

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

export function CharacterSheet({
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
  // Hide only unused rows. Core owns generation contributions and favored flags.
  const characteristics = Object.values(preview.characteristics).filter(
    (value) => value.baseline !== 0 || value.rolled !== 0 || value.favored,
  );
  return (
    <Stack>
      <Badge variant="light" color="gray">
        In progress
      </Badge>
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
      {characteristics.length > 0 && (
        <Table.ScrollContainer
          minWidth={360}
          type="native"
          tabIndex={0}
          aria-label="Characteristic table scrolling"
        >
          <Table
            aria-label="Sheet characteristics"
            horizontalSpacing={6}
            verticalSpacing={4}
            fz="sm"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Characteristic</Table.Th>
                <Table.Th scope="col" ta="right">
                  Baseline
                </Table.Th>
                <Table.Th scope="col" ta="right">
                  Generated
                </Table.Th>
                <Table.Th scope="col" ta="center">
                  Favored
                </Table.Th>
                <Table.Th scope="col" ta="right">
                  Total
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {characteristics.map((value) => (
                <Table.Tr key={value.characteristicKey}>
                  <Table.Th scope="row" fw={500}>
                    {previewCharacteristicLabels[value.characteristicKey]}
                  </Table.Th>
                  <Table.Td ta="right">{value.baseline}</Table.Td>
                  <Table.Td ta="right">{value.rolled}</Table.Td>
                  <Table.Td ta="center">
                    {value.favored && (
                      <IconCheck size={16} role="img" aria-label="Favored" />
                    )}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {value.baseline + value.rolled}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
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
