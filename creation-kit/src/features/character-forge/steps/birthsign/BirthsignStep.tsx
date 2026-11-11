import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { BIRTHSIGN_CHARGE_TABLES } from "@wayshrine/core";
import type {
  BirthsignChargeTable,
  BirthsignChoiceState,
  BirthsignEffect,
  BirthsignQuote,
  BirthsignQuoteResult,
  BirthsignRoll,
  BirthsignSelection,
  BirthsignSelectionResult,
  CharacterCreationSnapshot,
  ChoiceAnswer,
  ContentCatalog,
} from "@wayshrine/core";
import { LoadingIndicator } from "../../../../components/LoadingIndicator";
import { ErrorModal } from "../../../../components/ErrorModal";
import { ToContinue } from "../../components/ToContinue";
import { useContentSummaries } from "../../hooks/useContentSummaries";
import { readableLabel } from "../../labels";
import { characteristicLabels } from "../characteristics/characteristicLabels";

type Quote = (
  selection: BirthsignSelection,
  answers: readonly ChoiceAnswer<string>[],
) => Promise<BirthsignQuoteResult> | undefined;
type Command = Promise<BirthsignSelectionResult | undefined>;

interface Props {
  catalog: ContentCatalog;
  snapshot: CharacterCreationSnapshot;
  rollFace: () => number;
  onDiceError: (error: unknown) => void;
  submitRoll: (roll: BirthsignRoll) => Command;
  choose: (
    selection: BirthsignSelection,
    answers: readonly ChoiceAnswer<string>[],
  ) => Command;
  restore: () => Command;
  chooseBonus: (id: string, selections: readonly string[]) => unknown;
  setFreeChoice: (enabled: boolean) => unknown;
  quote: Quote;
  cancel: () => void;
  onErrorExit: () => void;
}

function characteristicLabel(key: string) {
  if (key === "lck") return "Luck";
  if (key in characteristicLabels)
    return characteristicLabels[key as keyof typeof characteristicLabels];
  return readableLabel(key);
}

function effectText(effect: BirthsignEffect) {
  if (
    effect.bonusType === "characteristic" ||
    effect.bonusType === "replaceRolledCharacteristic"
  ) {
    const name = characteristicLabel(effect.bonusTargetKey);
    return effect.bonusType === "characteristic"
      ? `${name}: ${effect.bonusValue > 0 ? "+" : ""}${effect.bonusValue}`
      : `${name} rolled value: ${effect.bonusValue}`;
  }
  if (effect.bonusType === "attribute")
    return `${readableLabel(effect.bonusTargetKey)}: ${effect.bonusValue > 0 ? "+" : ""}${effect.bonusValue}`;
  if (effect.bonusType === "multiplier")
    return `Natural healing multiplier: ${effect.bonusValue}`;
  if (effect.bonusType === "extraLuckyNumber")
    return `Extra lucky numbers: ${effect.count}, retained regardless of Luck`;
  if (effect.bonusType === "trait")
    return `Trait: ${readableLabel(effect.bonusTargetKey)} ${effect.bonusParams ? JSON.stringify(effect.bonusParams) : ""}`;
  return `Power: ${readableLabel(effect.bonusTargetKey)}`;
}

function EffectDescription({
  effect,
  catalog,
}: {
  effect: BirthsignEffect;
  catalog: ContentCatalog;
}) {
  const [detail, setDetail] = useState<{
    label: string;
    description: string;
  }>();
  const kind =
    effect.bonusType === "power" || effect.bonusType === "trait"
      ? effect.bonusType
      : undefined;
  const key =
    kind && (effect.bonusType === "power" || effect.bonusType === "trait")
      ? effect.bonusTargetKey
      : undefined;
  useEffect(() => {
    let live = true;
    setDetail(undefined);
    if (kind && key)
      void catalog.get(kind, key).then(
        (value) => {
          if (live) setDetail(value);
        },
        (error: unknown) =>
          console.error("Birthsign detail loading failed.", error),
      );
    return () => {
      live = false;
    };
  }, [catalog, kind, key]);
  if (!detail || !kind) return <span>{effectText(effect)}</span>;
  const params =
    effect.bonusType === "trait" && effect.bonusParams
      ? ` ${JSON.stringify(effect.bonusParams)}`
      : "";
  return (
    <span>
      {kind === "trait" ? "Trait" : "Power"}: {detail.label}
      {params} — {detail.description}
    </span>
  );
}

function Choices({
  choices,
  onChange,
  catalog,
}: {
  choices: readonly BirthsignChoiceState[];
  onChange: (id: string, values: string[]) => void;
  catalog: ContentCatalog;
}) {
  return (
    <Stack>
      {choices.map((choice) => {
        if (choice.lifecycle.selection === "recurring")
          return (
            <div key={choice.choiceGroup.id}>
              <Text fw={600}>{choice.choiceGroup.prompt}</Text>
              <Text>
                Choose {choice.choiceGroup.choose} after each long rest.
              </Text>
              {choice.choiceGroup.options.map((option) => (
                <Text key={option.id}>
                  {option.effects.map((effect, index) => (
                    <EffectDescription
                      key={index}
                      effect={effect}
                      catalog={catalog}
                    />
                  ))}
                </Text>
              ))}
            </div>
          );
        return (
          <fieldset key={choice.choiceGroup.id}>
            <legend>
              {choice.choiceGroup.prompt ||
                `Choose ${choice.choiceGroup.choose}`}
            </legend>
            {choice.choiceGroup.options.map((option) => (
              <label key={option.id} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={choice.selections.includes(option.id)}
                  onChange={(event) =>
                    onChange(
                      choice.choiceGroup.id,
                      event.currentTarget.checked
                        ? [...choice.selections, option.id]
                        : choice.selections.filter(
                            (value) => value !== option.id,
                          ),
                    )
                  }
                />{" "}
                {characteristicLabel(option.id)} —{" "}
                {option.effects.map((effect, index) => (
                  <EffectDescription
                    key={index}
                    effect={effect}
                    catalog={catalog}
                  />
                ))}
              </label>
            ))}
          </fieldset>
        );
      })}
    </Stack>
  );
}

function Package({
  quote,
  catalog,
}: {
  quote: BirthsignQuote;
  catalog: ContentCatalog;
}) {
  const [references, setReferences] = useState<
    Record<string, { label: string; description: string }>
  >({});
  const pack = quote.effectivePackage;
  const keys = JSON.stringify([
    ...(pack?.traits.map((trait) => `trait:${trait.traitKey}`) ?? []),
    ...(pack?.powers.map((power) => `power:${power.powerKey}`) ?? []),
  ]);
  useEffect(() => {
    let live = true;
    const refs: string[] = JSON.parse(keys);
    void Promise.all(
      refs.map(async (ref) => {
        const [kind, key] = ref.split(":") as ["trait" | "power", string];
        const value = await catalog.get(kind, key);
        return [ref, value] as const;
      }),
    ).then(
      (entries) => {
        if (live) {
          const next: Record<string, { label: string; description: string }> =
            {};
          for (const [key, value] of entries) if (value) next[key] = value;
          setReferences(next);
        }
      },
      (error: unknown) => {
        console.error("Birthsign details loading failed.", error);
      },
    );
    return () => {
      live = false;
    };
  }, [catalog, keys]);
  return (
    <Stack gap="xs">
      <Text>{quote.definition.description}</Text>
      {quote.selection.variant === "starCursed" &&
        quote.definition.starCursed.description && (
          <Text>{quote.definition.starCursed.description}</Text>
        )}
      <Text>
        Purchase cost:{" "}
        {quote.purchaseCost === undefined
          ? "Unavailable"
          : `${quote.purchaseCost} Luck`}
      </Text>
      <Text>
        Luck before purchase: {quote.luckBeforePurchase ?? "Pending"}; final
        Luck: {quote.finalLuck ?? "Pending"}
      </Text>
      {quote.eligibilityIssues.map((issue, index) => (
        <Text key={index} role="status">
          {issue.message}
        </Text>
      ))}
      {quote.affordability === "unaffordable" && (
        <Text role="status">Not enough Luck for this purchase.</Text>
      )}
      {!pack && (
        <Stack gap="xs" aria-label="Available birthsign effects">
          {quote.offeredBonuses
            .filter((entry) => entry.bonus.bonusType !== "choice")
            .map(
              (entry) =>
                entry.bonus.bonusType !== "choice" && (
                  <Text key={entry.sourceId}>
                    <EffectDescription effect={entry.bonus} catalog={catalog} />
                  </Text>
                ),
            )}
        </Stack>
      )}
      {pack && (
        <Stack gap="xs" aria-label="Birthsign effects">
          {Object.entries(pack.characteristicModifiers).map(
            ([key, modifiers]) => (
              <Text key={key}>
                {characteristicLabel(key)}:{" "}
                {modifiers.map((modifier) => modifier.value).join(", ")}
              </Text>
            ),
          )}
          {Object.entries(pack.rolledReplacements).map(([key, value]) => (
            <Text key={key}>
              {characteristicLabel(key)} rolled value: {value}
            </Text>
          ))}
          {pack.spMaximum.map((modifier, index) => (
            <Text key={`sp${index}`}>SP maximum: {modifier.value}</Text>
          ))}
          {pack.speed.map((modifier, index) => (
            <Text key={`speed${index}`}>Speed: {modifier.value}</Text>
          ))}
          {pack.naturalHealingMultiplier !== 1 && (
            <Text>
              Natural healing multiplier: {pack.naturalHealingMultiplier}
            </Text>
          )}
          {pack.extraLuckyNumbers.map((entry) => (
            <Text key={entry.sourceId}>
              Extra lucky numbers: {entry.count}, retained regardless of Luck
            </Text>
          ))}
          {pack.traits.map((trait, index) => (
            <Text key={index}>
              Trait:{" "}
              {references[`trait:${trait.traitKey}`]?.label ??
                readableLabel(trait.traitKey)}{" "}
              {trait.params && JSON.stringify(trait.params)} —{" "}
              {references[`trait:${trait.traitKey}`]?.description}
            </Text>
          ))}
          {pack.powers.map((power) => (
            <Text key={power.sourceId}>
              Power:{" "}
              {references[`power:${power.powerKey}`]?.label ??
                readableLabel(power.powerKey)}{" "}
              — {references[`power:${power.powerKey}`]?.description}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function BirthsignStep(props: Props) {
  const { catalog, snapshot } = props;
  const state = snapshot.birthsignSelection;
  const summaries = useContentSummaries(catalog, "birthsign");
  const [charge, setCharge] = useState<BirthsignChargeTable["guardian"]>();
  const [chooser, setChooser] = useState(false);
  const [candidate, setCandidate] = useState<BirthsignSelection>();
  const [answers, setAnswers] = useState<ChoiceAnswer<string>[]>([]);
  const [quoted, setQuoted] = useState<{
    key: string;
    value: BirthsignQuote;
  }>();
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [quoteErrorAcknowledged, setQuoteErrorAcknowledged] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<{
    key: string;
    value: BirthsignQuote;
  }>();
  const [retry, setRetry] = useState(0);
  const [issues, setIssues] = useState<readonly { message: string }[]>([]);
  const quoteRef = useRef(props.quote);
  quoteRef.current = props.quote;
  const requested = candidate ?? state.selected;
  const quoteAnswers = candidate ? answers : state.answers;
  const quoteKey = JSON.stringify([
    requested,
    quoteAnswers,
    state.freeChoice,
    state.original,
    snapshot.characteristicGeneration,
    snapshot.answers.raceKey,
    retry,
  ]);
  useEffect(() => {
    let live = true;
    if (!requested) {
      setQuoted(undefined);
      setQuoteStatus("idle");
      return;
    }
    setQuoted(undefined);
    setQuoteStatus("loading");
    const pending = quoteRef.current(requested, quoteAnswers);
    if (!pending) return;
    void pending.then((result) => {
      if (!live) return;
      if (!result.ok) {
        console.error("Birthsign quote failed.", result.issues);
        setQuoteErrorAcknowledged(false);
        setQuoteStatus("error");
        return;
      }
      setQuoted({ key: quoteKey, value: result.value });
      setQuoteStatus("idle");
    });
    return () => {
      live = false;
    };
    // The serialized key captures the current context without depending on render-local callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);
  const quote = quoted?.key === quoteKey ? quoted.value : undefined;
  const selectedKey = JSON.stringify([
    state.selected,
    state.answers,
    state.freeChoice,
    state.original,
    snapshot.characteristicGeneration,
    snapshot.answers.raceKey,
  ]);
  useEffect(() => {
    let live = true;
    if (!state.selected) {
      setSelectedQuote(undefined);
      return;
    }
    const pending = quoteRef.current(state.selected, state.answers);
    if (pending)
      void pending.then((result) => {
        if (live && result.ok)
          setSelectedQuote({ key: selectedKey, value: result.value });
      });
    return () => {
      live = false;
    };
    // Selection and contextual inputs are represented by selectedKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);
  const currentQuote =
    selectedQuote?.key === selectedKey ? selectedQuote.value : undefined;
  const label = (key: string) =>
    readableLabel(
      key,
      summaries.status === "ready"
        ? summaries.entries.find((entry) => entry.key === key)?.label
        : undefined,
    );
  const actions = [];
  if (snapshot.steps.some((step) => step.id !== "birthsign" && !step.complete))
    actions.push({
      id: "previous",
      label: "resolve issues in previous step(s)",
    });
  if (!state.complete)
    actions.push({
      id: "birthsign",
      label:
        state.load?.status === "loading"
          ? "loading birthsign"
          : "complete birthsign selection",
      loading: state.load?.status === "loading",
    });
  function changeCandidate(selection: BirthsignSelection) {
    setCandidate(selection);
    setAnswers([]);
    setIssues([]);
  }
  async function roll() {
    if (!charge) return;
    try {
      const dice: number[] = [];
      let face: number;
      do {
        face = props.rollFace();
        if (!Number.isInteger(face) || face < 1 || face > 5)
          throw new Error("Invalid d5 result");
        dice.push(face);
      } while (face === 5);
      const result = await props.submitRoll({
        id: "birthsign-roll",
        charge,
        dice,
      });
      if (result && !result.ok) setIssues(result.issues);
    } catch (error) {
      props.onDiceError(error);
    }
  }
  async function commit() {
    if (!candidate) return;
    const result = await props.choose(candidate, answers);
    if (result?.ok) {
      setCandidate(undefined);
      setChooser(false);
      setIssues([]);
    } else if (result) setIssues(result.issues);
  }
  const showChooser = chooser || state.freeChoice;
  return (
    <Stack>
      <Title order={2}>Birthsign</Title>
      <ToContinue actions={actions} />
      {summaries.status === "loading" && (
        <LoadingIndicator label="Loading birthsigns" />
      )}
      {summaries.status === "error" && (
        <>
          <ErrorModal
            stackId="birthsign-index-error"
            opened={!summaries.acknowledged}
            onClose={summaries.acknowledge}
            onExitTransitionEnd={props.onErrorExit}
          />
          <Button onClick={summaries.retry}>Retry birthsigns</Button>
        </>
      )}
      {!state.original && !state.freeChoice && (
        <>
          <Text>Choose a charge to inspect its signs before rolling.</Text>
          <Group align="stretch">
            {BIRTHSIGN_CHARGE_TABLES.map((table) => (
              <Paper key={table.guardian} withBorder p="sm">
                <Button
                  variant={charge === table.guardian ? "filled" : "default"}
                  aria-pressed={charge === table.guardian}
                  onClick={() => setCharge(table.guardian)}
                >
                  {readableLabel(table.guardian)}
                </Button>
                <Text size="sm">{table.entries.map(label).join(", ")}</Text>
              </Paper>
            ))}
          </Group>
          {charge && (
            <>
              <Table aria-label={`${readableLabel(charge)} charge roll table`}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Roll</Table.Th>
                    <Table.Th>Result</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {BIRTHSIGN_CHARGE_TABLES.find(
                    (table) => table.guardian === charge,
                  )?.entries.map((key, index) => (
                    <Table.Tr key={key}>
                      <Table.Td>{index + 1}</Table.Td>
                      <Table.Td>{label(key)}</Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td>5</Table.Td>
                    <Table.Td>Reroll; Star-Cursed</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              <Button
                onClick={() => void roll()}
                disabled={state.load?.status === "loading"}
              >
                Roll birthsign
              </Button>
            </>
          )}
        </>
      )}
      {state.original && (
        <Text>
          Roll: {state.original.roll.dice.join(" → ")} (
          {readableLabel(state.original.roll.charge)})
        </Text>
      )}
      {state.selected && (
        <>
          <Group>
            <Title order={3}>
              {state.definition?.label ?? label(state.selected.signKey)}
            </Title>
            <Badge>
              {state.selected.variant === "normal" ? "Normal" : "Star-Cursed"}
            </Badge>
          </Group>
          {currentQuote && <Package quote={currentQuote} catalog={catalog} />}
          <Choices
            choices={state.choices}
            onChange={props.chooseBonus}
            catalog={catalog}
          />
          {state.original &&
            state.selected.variant === "normal" &&
            state.original.selection.signKey === state.selected.signKey && (
              <Button
                variant="light"
                onClick={() => {
                  setChooser(true);
                  changeCandidate({
                    ...state.selected!,
                    variant: "starCursed",
                  });
                }}
              >
                Take Star-Cursed version
              </Button>
            )}
          {state.original && (
            <Button variant="default" onClick={() => void props.restore()}>
              Restore original birthsign
            </Button>
          )}
        </>
      )}
      {!state.freeChoice && (
        <Button variant="subtle" onClick={() => setChooser(!chooser)}>
          {chooser ? "Close chooser" : "Choose a Birthsign instead…"}
        </Button>
      )}
      {showChooser && (
        <Stack>
          <Title order={3}>Choose a Birthsign</Title>
          {BIRTHSIGN_CHARGE_TABLES.map((table) => (
            <div key={table.guardian}>
              <Text fw={600}>{readableLabel(table.guardian)}</Text>
              <Group>
                {table.entries.map((key) => (
                  <Button
                    size="xs"
                    variant={candidate?.signKey === key ? "filled" : "default"}
                    key={key}
                    onClick={() =>
                      changeCandidate({ signKey: key, variant: "normal" })
                    }
                  >
                    {label(key)}
                  </Button>
                ))}
              </Group>
            </div>
          ))}
          {candidate && (
            <>
              <Title order={4}>Inspecting {label(candidate.signKey)}</Title>
              <Select
                label="Variant"
                value={candidate.variant}
                allowDeselect={false}
                data={[
                  { value: "normal", label: "Normal" },
                  { value: "starCursed", label: "Star-Cursed" },
                ]}
                onChange={(value) => {
                  if (value === "normal" || value === "starCursed")
                    changeCandidate({ ...candidate, variant: value });
                }}
              />
              {quoteStatus === "loading" && (
                <LoadingIndicator label="Loading birthsign quote" />
              )}
              {quoteStatus === "error" && (
                <>
                  <ErrorModal
                    stackId="birthsign-quote-error"
                    opened={!quoteErrorAcknowledged}
                    onClose={() => setQuoteErrorAcknowledged(true)}
                    onExitTransitionEnd={props.onErrorExit}
                  />
                  <Button onClick={() => setRetry(retry + 1)}>
                    Retry birthsign details
                  </Button>
                </>
              )}
              {quote && (
                <>
                  <Package quote={quote} catalog={catalog} />
                  <Choices
                    choices={quote.choices}
                    catalog={catalog}
                    onChange={(id, selections) =>
                      setAnswers((current) => [
                        ...current.filter((entry) => entry.choiceId !== id),
                        { choiceId: id, selections },
                      ])
                    }
                  />
                  <Button
                    disabled={
                      !quote.eligible ||
                      !quote.effectivePackage ||
                      quote.affordability !== "affordable" ||
                      quote.missingInputs.length > 0 ||
                      !!state.load
                    }
                    onClick={() => void commit()}
                  >
                    Use this Birthsign
                  </Button>
                </>
              )}
            </>
          )}
        </Stack>
      )}
      {state.load?.status === "loading" && (
        <LoadingIndicator label="Loading birthsign" />
      )}
      {state.load?.status === "failed" && (
        <Group>
          <Button
            onClick={() => {
              if (candidate) void commit();
              else if (state.original) void props.restore();
            }}
          >
            Retry birthsign selection
          </Button>
          <Button variant="default" onClick={props.cancel}>
            Cancel birthsign selection
          </Button>
        </Group>
      )}
      {issues.map((issue, index) => (
        <Text role="status" key={index}>
          {issue.message}
        </Text>
      ))}
      <Accordion keepMountedMode="display-none">
        <Accordion.Item value="options">
          <Accordion.Control>Options</Accordion.Control>
          <Accordion.Panel>
            <Switch
              label="Use Player-Chosen Birthsigns"
              description="Use only with group agreement."
              checked={state.freeChoice}
              onChange={(event) => {
                props.setFreeChoice(event.currentTarget.checked);
                setCandidate(undefined);
              }}
            />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
