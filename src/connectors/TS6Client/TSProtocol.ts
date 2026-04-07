// ─── TSProtocol ───────────────────────────────────────────────────────────────
// Definerer meldingsformatet for TS6 klientprotokollen.
//
// STUB: Alle meldingstyper og payload-strukturer er ukjente og må
// fylles inn etter protokoll-analyse med Wireshark / Chrome DevTools.
// Se dokumentasjon seksjon 5 for fremgangsmåte.
//
// Kjente mønstre fra TS5 Remote App API (sannsynligvis likt i TS6):
//   { "type": "auth",        "payload": { ... } }
//   { "type": "channelJoin", "payload": { ... } }

import type { TS6Message } from '../../core/types.js';

// ─── Meldingstyper ────────────────────────────────────────────────────────────
// TODO: Erstatt med faktiske type-strenger fra WS-dump

export const MessageType = {
  // Innkommende fra server
  AUTH_RESPONSE:        'auth',             // TODO: verifiser
  CLIENT_MOVED:         'clientMoved',      // TODO: verifiser
  STREAM_STARTED:       'streamStarted',    // TODO: ukjent — finn i dump
  STREAM_STOPPED:       'streamStopped',    // TODO: ukjent — finn i dump
  WEBRTC_OFFER:         'webrtcOffer',      // TODO: ukjent — finn i dump
  WEBRTC_ICE_CANDIDATE: 'webrtcIce',        // TODO: ukjent — finn i dump

  // Utgående til server
  AUTH:                 'auth',             // TODO: verifiser
  CHANNEL_JOIN:         'channelJoin',      // TODO: ukjent — finn i dump
  SCREEN_SUBSCRIBE:     'screenSubscribe',  // TODO: ukjent — finn i dump
  WEBRTC_ANSWER:        'webrtcAnswer',     // TODO: ukjent — finn i dump
} as const;

// ─── Meldingsbyggere ──────────────────────────────────────────────────────────

export function buildAuthMessage(identity: string, token: string): TS6Message {
  // TODO: Fyll inn korrekt payload basert på WS-dump
  return {
    type: MessageType.AUTH,
    payload: {
      identity,
      token,
      // Legg til felt etter hva du ser i WS-trafikken
    },
  };
}

export function buildChannelJoinMessage(channelId: string): TS6Message {
  // TODO: Fyll inn korrekt payload
  return {
    type: MessageType.CHANNEL_JOIN,
    payload: { channelId },
  };
}

export function buildScreenSubscribeMessage(streamerId: string): TS6Message {
  // TODO: Fyll inn korrekt payload
  return {
    type: MessageType.SCREEN_SUBSCRIBE,
    payload: { streamerId },
  };
}

export function buildWebRTCAnswerMessage(sdp: string): TS6Message {
  // TODO: Fyll inn korrekt payload
  return {
    type: MessageType.WEBRTC_ANSWER,
    payload: { sdp },
  };
}

// ─── Parser for innkommende meldinger ─────────────────────────────────────────

export function parseIncoming(raw: string): TS6Message | null {
  try {
    return JSON.parse(raw) as TS6Message;
  } catch {
    // Ikke-JSON — kan være binær RTP-data
    return null;
  }
}
