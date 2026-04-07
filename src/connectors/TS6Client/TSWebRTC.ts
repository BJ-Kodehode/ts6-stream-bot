// ─── TSWebRTC ─────────────────────────────────────────────────────────────────
// Håndterer WebRTC peer connection mot TS6-serveren.
// Mottar H.264 video-stream og publiserer frames til EventBus.
//
// STUB: Krever at TS6 sin WebRTC-signaliseringsprotokoll er kartlagt
// (SDP offer/answer og ICE candidate-format fra WS-dump).
//
// Avhengighet som må installeres når protokollen er kjent:
//   npm install wrtc  (eller @roamhq/wrtc)

import type { EventBus } from '../../core/EventBus.js';

// TODO: Aktiver når wrtc er installert og protokoll er kjent
// import wrtc from 'wrtc';
// const { RTCPeerConnection, RTCSessionDescription } = wrtc;

export class TSWebRTC {
  private peerConnection: unknown = null;
  private eventBus: EventBus;
  private connected = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // Kalles når TSSignaling mottar et WebRTC offer fra TS6-server
  async handleOffer(sdpOffer: string): Promise<string> {
    // TODO: Implementer når wrtc er installert og SDP-format er kjent
    //
    // this.peerConnection = new RTCPeerConnection({
    //   iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    // });
    //
    // // Lytt på innkommende video-tracks
    // this.peerConnection.ontrack = (event) => {
    //   this.handleVideoTrack(event.track, event.streams[0]);
    // };
    //
    // await this.peerConnection.setRemoteDescription(
    //   new RTCSessionDescription({ type: 'offer', sdp: sdpOffer })
    // );
    //
    // const answer = await this.peerConnection.createAnswer();
    // await this.peerConnection.setLocalDescription(answer);
    // return answer.sdp;

    console.warn('[TSWebRTC] handleOffer() ikke implementert ennå — venter på protokollanalyse');
    return '';
  }

  // Kalles for hver ICE candidate fra TS6-server
  async addIceCandidate(candidate: string, sdpMid: string): Promise<void> {
    // TODO: Implementer
    // await this.peerConnection.addIceCandidate({ candidate, sdpMid });
    console.warn('[TSWebRTC] addIceCandidate() ikke implementert ennå');
  }

  disconnect(): void {
    // TODO: this.peerConnection?.close();
    this.peerConnection = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ─── Privat: håndter innkommende video-track ────────────────────────────────

  private handleVideoTrack(_track: unknown, _stream: unknown): void {
    // TODO: Implementer når wrtc-track mottar H.264 frames
    //
    // track.onmessage (for DataChannel) eller RTP-receiver (for MediaTrack)
    // publiserer RawH264Frame til EventBus:
    //
    // this.eventBus.emit('frame:raw', {
    //   data:      Buffer.from(frameData),
    //   timestamp: Date.now(),
    // });

    console.warn('[TSWebRTC] handleVideoTrack() ikke implementert ennå');
  }
}
