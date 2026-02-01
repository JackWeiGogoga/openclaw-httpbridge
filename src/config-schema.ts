import { z } from "zod";

const HttpBridgeAccountSchema = z
  .object({
    enabled: z.boolean().optional(),
    token: z.string().min(1).optional(),
    webhookPath: z.string().min(1).optional(),
    callbackDefault: z.string().url().optional(),
    allowCallbackHosts: z.array(z.string().min(1)).optional(),
    callbackTtlMinutes: z.number().int().positive().optional(),
    maxCallbackEntries: z.number().int().positive().optional(),
  })
  .strict();

export const HttpBridgeConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    token: z.string().min(1).optional(),
    webhookPath: z.string().min(1).optional(),
    callbackDefault: z.string().url().optional(),
    allowCallbackHosts: z.array(z.string().min(1)).optional(),
    callbackTtlMinutes: z.number().int().positive().optional(),
    maxCallbackEntries: z.number().int().positive().optional(),
    defaultAccount: z.string().min(1).optional(),
    accounts: z.record(HttpBridgeAccountSchema).optional(),
  })
  .strict();

export type HttpBridgeAccountInput = z.infer<typeof HttpBridgeAccountSchema>;
export type HttpBridgeConfigInput = z.infer<typeof HttpBridgeConfigSchema>;
