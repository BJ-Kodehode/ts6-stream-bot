// ─── TSSignaling ──────────────────────────────────────────────────────────────
// WebSocket-tilkobling mot TS6-serveren.
// Håndterer auth, channel join og WebRTC-signalisering.
// Delegerer WebRTC-logikk til TSWebRTC.

import WebSocket from 'ws';
import { appendFileSync } from 'fs';
import {
  MessageType,
  buildAuthMessage,
  buildChannelJoinMessage,
  buildScreenSubscribeMessage,
  buildWebRTCAnswerMessage,
  parseIncoming,
} from './TSProtocol.js';
import { TSWebRTC } from './TSWebRTC.js';
import type { TS6Message } from '../../core/types.js';
import type { EventBus } from '../../core/EventBus.js';

export class TSSignaling {
  private ws:             WebSocket | null = null;
  private webrtc:         TSWebRTC;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private serverUrl =     '';
  private debugMode =     false;

  constructor(private eventBus: EventBus) {
    this.webrtc = new TSWebRTC(eventBus);
  }

  enableDebugDump(enabled = true): void {
    this.debugMode = enabled;
  }

  async connect(serverUrl: string): Promise<void> {
    this.serverUrl = serverUrl;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(serverUrl);

      this.ws.on('open', () => {
        console.log(`[TSSignaling] Tilkoblet: ${serverUrl}`);
        resolve();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleRawMessage(data);
      });

      this.ws.on('close', () => {
        console.warn('[TSSignaling] Tilkobling lukket — prøver igjen om 5s...');
        this.reconnectTimer = setTimeout(() => this.connect(this.serverUrl), 5000);
      });

      this.ws.on('error', (err) => {
        console.error('[TSSignaling] Feil:', err.message);
        if (this.ws?.readyState !== WebSocket.OPEN) reject(err);
      });
    });
  }

  // Kalles av StreamBridgeComponent etter tilkobling
  async authenticate(identity: string, token: string): Promise<void> {
    this.send(buildAuthMessage(identity, token));
  }

  async joinChannel(channelId: string): Promise<void> {
    this.send(buildChannelJoinMessage(channelId));
  }

  async subscribeToScreenShare(streamerId: string): Promise<void> {
    this.send(buildScreenSubscribeMessage(streamerId));
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.webrtc.disconnect();
    this.ws?.close();
    this.ws = null;
  }

  // ─── Innkommende meldinger ────────────────────────────────────────────────

  private handleRawMessage(data: WebSocket.RawData): void {
    const raw = data.toString();

    // Debug-dump til fil (aktiveres av DebugComponent)
    if (this.debugMode) {
      appendFileSync('ts6-ws-raw.jsonl',
        JSON.stringify({ ts: new Date().toISOString(), raw }) + '\n'
      );
    }

    const msg = parseIncoming(raw);
    if (!msg) return; // Binær data — håndteres separat av TSWebRTC

    this.routeMessage(msg);
  }

  private routeMessage(msg: TS6Message): void {
    switch (msg.type) {
      case MessageType.STREAM_STARTED:
        // TODO: Hent clientId fra payload når format er kjent
        this.eventBus.emit('ts6:streamStarted', String(msg.payload.clientId ?? 'unknown'));
        break;

      case MessageType.STREAM_STOPPED:
        this.eventBus.emit('ts6:streamStopped', String(msg.payload.clientId ?? 'unknown'));
        break;

      case MessageType.CLIENT_MOVED:
        this.eventBus.emit('ts6:clientJoined',
          String(msg.payload.clientId ?? ''),
          String(msg.payload.channelId ?? ''),
        );
        break;

      case MessageType.WEBRTC_OFFER:
        // TODO: Hent SDP fra payload når format er kjent
        this.handleWebRTCOffer(String(msg.payload.sdp ?? ''));
        break;

      case MessageType.WEBRTC_ICE_CANDIDATE:
        // TODO: Hent candidate fra payload når format er kjent
        this.webrtc.addIceCandidate(
          String(msg.payload.candidate ?? ''),
          String(msg.payload.sdpMid ?? ''),
        );
        break;

      default:
        // Ukjent meldingstype — logg for protokollanalyse
        console.debug(`[TSSignaling] Ukjent type: ${msg.type}`, msg.payload);
        break;
    }
  }

  private async handleWebRTCOffer(sdpOffer: string): Promise<void> {
    const sdpAnswer = await this.webrtc.handleOffer(sdpOffer);
    if (sdpAnswer) {
      this.send(buildWebRTCAnswerMessage(sdpAnswer));
    }
  }

  private send(msg: TS6Message): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[TSSignaling] Kan ikke sende — ikke tilkoblet');
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }
}
