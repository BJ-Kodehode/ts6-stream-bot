import { z } from 'zod';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import type { BotConfig } from '../core/types.js';

const ConfigSchema = z.object({
  teamspeak: z.object({
    apiUrl:      z.string().url('teamspeak.apiUrl må være en gyldig URL'),
    apiKey:      z.string().min(1, 'teamspeak.apiKey kan ikke være tom'),
    wsUrl:       z.string().min(1, 'teamspeak.wsUrl kan ikke være tom'),
    webhookPort: z.number().int().default(3000),
  }),
  livekit: z.object({
    url:       z.string().min(1),
    apiKey:    z.string().min(1),
    apiSecret: z.string().min(1),
    roomName:  z.string().min(1),
  }),
  bot: z.object({
    identity: z.string().default('ts6-stream-bot'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

export function loadConfig(path = 'config.yaml'): BotConfig {
  let raw: unknown;
  try {
    raw = parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(`Klarte ikke å lese ${path}: ${err}`);
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Ugyldig konfigurasjon i ${path}:\n${errors}`);
  }

  return result.data;
}
