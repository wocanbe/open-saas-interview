import * as z from "zod";

export const animationEnvSchema = z.object({
  RECORDING_OUTPUT_DIR: z.string().optional().default("/app/recording-output"),
  PUPPETEER_IMAGE: z.string().optional().default("ghcr.io/puppeteer/puppeteer:latest"),
});
