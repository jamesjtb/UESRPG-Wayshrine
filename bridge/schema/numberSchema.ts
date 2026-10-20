import { z } from "zod";

export const intSchema = z.int();
export const nonnegativeIntSchema = intSchema.nonnegative();
