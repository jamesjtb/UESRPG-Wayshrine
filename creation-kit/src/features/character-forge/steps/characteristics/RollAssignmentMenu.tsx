import { useLayoutEffect, useRef } from "react";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAssignments,
  CharacteristicRoll,
} from "@wayshrine/core";
import { characteristicLabels } from "./characteristicLabels";
import { RollTile } from "./RollTile";
import { AssignmentMenu } from "../../components/AssignmentMenu";
import { rollTotal } from "./dice";

interface Props {
  roll: CharacteristicRoll;
  ordinal: number;
  assignments: CharacteristicAssignments;
  onAssign: (key: Characteristic) => void;
  onUnassign: () => void;
}

export function RollAssignmentMenu({
  roll,
  ordinal,
  assignments,
  onAssign,
  onUnassign,
}: Props) {
  const assigned = Object.values(Characteristic).find(
    (key) => assignments[key] === roll.id,
  );
  const tileRef = useRef<HTMLButtonElement>(null);
  const focusAfterChange = useRef(false);

  useLayoutEffect(() => {
    if (!focusAfterChange.current) return;
    tileRef.current?.focus();
    focusAfterChange.current = false;
  }, [assigned]);

  const available = Object.values(Characteristic).filter(
    (key) => assignments[key] === undefined,
  );
  const options: { value: string; label: string }[] = available.map((key) => ({
    value: key,
    label: characteristicLabels[key],
  }));
  function selectOption(value: string) {
    const key = Object.values(Characteristic).find(
      (candidate) => candidate === value,
    );
    if (!key) return;
    focusAfterChange.current = true;
    onAssign(key);
  }

  function unassignRoll() {
    focusAfterChange.current = true;
    onUnassign();
  }

  if (assigned) {
    const label = characteristicLabels[assigned];
    return (
      <RollTile
        ref={tileRef}
        roll={roll}
        label={`Roll ${ordinal}`}
        assignment={label}
        aria-label={`Roll ${ordinal}, total ${rollTotal(roll)}, assigned ${label}, unassign`}
        onClick={unassignRoll}
      />
    );
  }

  return (
    <AssignmentMenu
      trigger={<RollTile ref={tileRef} roll={roll} label={`Roll ${ordinal}`} />}
      options={options}
      onSelect={selectOption}
    />
  );
}
