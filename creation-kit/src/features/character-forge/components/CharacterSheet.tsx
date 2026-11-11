import type { ReactElement } from "react";
import {
  List,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconStarFilled } from "@tabler/icons-react";
import type { CharacterCreator } from "@wayshrine/core";
import {
  calculateCharacteristicScore,
  PcCharacteristic,
  SkillRank,
} from "@wayshrine/core";
import { plainDescription, readableLabel } from "../labels";
import { characteristicLabels } from "../steps/characteristics/characteristicLabels";

const previewCharacteristicLabels = { ...characteristicLabels, lck: "Luck" };

type Preview = ReturnType<CharacterCreator["getCharacterPreview"]>;

function ScoreDetails({
  calculation,
  children,
}: {
  calculation: string;
  children: ReactElement;
}) {
  return (
    <Tooltip
      label={calculation}
      events={{ hover: true, focus: true, touch: true }}
    >
      {children}
    </Tooltip>
  );
}

function traitParameters(
  params: Readonly<Record<string, string | number>> | undefined,
) {
  if (!params) return "";
  const entries = Object.entries(params).map(
    ([key, value]) => `${readableLabel(key)}: ${value}`,
  );
  return ` (${entries.join(", ")})`;
}

function signedContribution(value: number): string {
  return value < 0 ? ` - ${Math.abs(value)}` : ` + ${value}`;
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
  const characteristics = Object.values(PcCharacteristic).map((key) => {
    const value = preview.characteristics[key];
    const score = calculateCharacteristicScore(value);
    const modifiers = value.modifiers
      .map((modifier) => signedContribution(modifier.value))
      .join("");
    const purchase = value.purchaseCost ? ` - ${value.purchaseCost.value}` : "";
    const inputs =
      modifiers || purchase
        ? "baseline + generated + modifiers - purchase cost"
        : "baseline + generated";
    return {
      ...value,
      ...score,
      label: previewCharacteristicLabels[key],
      calculation: `${previewCharacteristicLabels[key]}: ${value.baseline} + ${value.rolled}${modifiers}${purchase} = ${score.total} (${inputs})`,
    };
  });
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
      <Table.ScrollContainer
        minWidth={760}
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
              {characteristics.map((value) => (
                <Table.Th
                  key={value.characteristicKey}
                  scope="col"
                  ta="center"
                  aria-label={
                    value.favored ? `${value.label}, Favored` : value.label
                  }
                >
                  {value.label}
                  {value.favored && (
                    <IconStarFilled
                      size={16}
                      role="img"
                      aria-label="Favored"
                      style={{
                        marginInlineStart: 4,
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Th scope="row" fw={500}>
                Total
              </Table.Th>
              {characteristics.map((value) => (
                <ScoreDetails
                  key={value.characteristicKey}
                  calculation={value.calculation}
                >
                  <Table.Td
                    ta="center"
                    fw={600}
                    tabIndex={0}
                    aria-description={value.calculation}
                  >
                    {value.total}
                  </Table.Td>
                </ScoreDetails>
              ))}
            </Table.Tr>
            <Table.Tr>
              <Table.Th scope="row" fw={500}>
                Bonus
              </Table.Th>
              {characteristics.map((value) => (
                <Table.Td key={value.characteristicKey} ta="center">
                  {value.bonus}
                </Table.Td>
              ))}
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
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
