import { z } from "zod";
import { PcCharacteristic } from "../enum/Characteristic";

const key = z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/);
const text = z.string().refine((value) => value.trim().length > 0);
const characteristic = z.enum(PcCharacteristic);

export const birthsignEffectSchema = z.discriminatedUnion("bonusType", [
  z.strictObject({
    bonusType: z.literal("characteristic"),
    bonusTargetKey: characteristic,
    bonusValue: z.number(),
  }),
  z.strictObject({
    bonusType: z.literal("attribute"),
    bonusTargetKey: z.enum(["spMaximum", "speed"]),
    bonusValue: z.number(),
  }),
  z.strictObject({
    bonusType: z.literal("multiplier"),
    bonusTargetKey: z.literal("naturalHealing"),
    bonusValue: z.number(),
  }),
  z.strictObject({
    bonusType: z.literal("trait"),
    bonusTargetKey: key,
    bonusParams: z
      .record(key, z.union([z.string(), z.number()]))
      .exactOptional(),
  }),
  z.strictObject({ bonusType: z.literal("power"), bonusTargetKey: key }),
  z.strictObject({
    bonusType: z.literal("extraLuckyNumber"),
    count: z.number().int().positive(),
    retainedRegardlessOfLuck: z.literal(true),
  }),
  z.strictObject({
    bonusType: z.literal("replaceRolledCharacteristic"),
    bonusTargetKey: characteristic,
    bonusValue: z.number(),
  }),
]);

export const birthsignChoiceSchema = z.strictObject({
  bonusType: z.literal("choice"),
  choiceGroup: z
    .strictObject({
      id: key,
      prompt: text.exactOptional(),
      choose: z.number().int().positive(),
      options: z
        .array(
          z.strictObject({
            id: key,
            effects: z.array(birthsignEffectSchema).min(1),
          }),
        )
        .min(1),
    })
    .superRefine((group, context) => {
      if (group.choose > group.options.length)
        context.addIssue({
          code: "custom",
          path: ["choose"],
          message: "Choice count exceeds available options.",
        });
      if (
        new Set(group.options.map((option) => option.id)).size !==
        group.options.length
      )
        context.addIssue({
          code: "custom",
          path: ["options"],
          message: "Option IDs must be distinct.",
        });
    }),
  lifecycle: z.union([
    z.strictObject({ selection: z.literal("once") }),
    z.strictObject({
      selection: z.literal("recurring"),
      chooseAt: z.literal("longRest"),
      expiresAt: z.literal("nextLongRest"),
    }),
  ]),
});

const bonuses = z.array(
  z.union([birthsignEffectSchema, birthsignChoiceSchema]),
);
export const birthsignSchema = z
  .strictObject({
    label: text,
    description: text,
    bonuses,
    starCursed: z.strictObject({
      description: text.exactOptional(),
      overwriteBaseBonuses: z.boolean(),
      bonuses,
      eligibility: z
        .strictObject({
          requiresNaturallyRolledSign: z.literal(true),
          canSelectBySpendingLuck: z.literal(false),
        })
        .exactOptional(),
    }),
  })
  .superRefine((sign, context) => {
    const groups = [...sign.bonuses, ...sign.starCursed.bonuses].filter(
      (bonus) => bonus.bonusType === "choice",
    );
    if (
      new Set(groups.map((bonus) => bonus.choiceGroup.id)).size !==
      groups.length
    )
      context.addIssue({
        code: "custom",
        message: "Choice group IDs must be distinct within a birthsign.",
      });
  });
