// ─── Felles typer og interfaces ───────────────────────────────────────────────

export interface BotConfig {
  teamspeak: {
    apiUrl:      string;
    apiKey:      string;
    wsUrl:       string;
    webhookPort: number;
  };
  livekit: {
    url:       string;
    apiKey:    string;
    apiSecret: string;
    roomName:  string;
  };
  bot: {
    identity: string;
    logLevel: string;
  };
}

// Rå H.264-frame slik den kommer fra TS6 via WebRTC
export interface RawH264Frame {
  data:      Buffer;
  timestamp: number;
  userId?:   string;
}

// Ferdig assemblert H.264-frame klar for LiveKit
export interface H264Frame {
  data:       Buffer;
  isKeyframe: boolean;
  timestamp:  number;
  sps?:       Buffer;
  pps?:       Buffer;
}

// TS6 WebSocket-melding (JSON)
export interface TS6Message {
  type:    string;
  payload: Record<string, unknown>;
}

// TS6 webhook-event fra serveren
export interface TS6WebhookEvent {
  event:     string;
  data:      Record<string, unknown>;
  timestamp: number;
}

// BotContext — deles med alle komponenter via onInit()
export interface BotContext {
  config:    BotConfig;
  ts6Api:    import('../api/TS6RestClient.js').TS6RestClient;
  eventBus:  import('./EventBus.js').EventBus;
  logger:    import('winston').Logger;
}
