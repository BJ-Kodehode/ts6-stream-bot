import EventEmitter from 'eventemitter3';
import type { TS6WebhookEvent, RawH264Frame } from './types.js';

// ─── Typede events for hele boten ─────────────────────────────────────────────

export interface BotEvents {
  // TS6 server-events
  'ts6:webhook':       (event: TS6WebhookEvent) => void;
  'ts6:clientJoined':  (clientId: string, channelId: string) => void;
  'ts6:clientLeft':    (clientId: string) => void;
  'ts6:streamStarted': (clientId: string) => void;
  'ts6:streamStopped': (clientId: string) => void;

  // Media-pipeline
  'frame:raw':         (frame: RawH264Frame) => void;

  // Bot lifecycle
  'bot:ready':         () => void;
  'bot:shutdown':      () => void;
}

export class EventBus extends EventEmitter<BotEvents> {}
