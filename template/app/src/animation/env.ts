import * as z from "zod";

export const animationEnvSchema = z.object({
  RECORDING_SERVICE_URL: z.string().url().optional().default("http://localhost:3001"),
});
