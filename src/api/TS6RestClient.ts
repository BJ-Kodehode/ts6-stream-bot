// ─── TS6 REST API-klient (port 10080) ────────────────────────────────────────
// Full API-dokumentasjon: http://<server>:10080/swagger

export interface TS6Client {
  clid:                     number;
  nickname:                 string;
  cid:                      number;
  client_unique_identifier: string;
  talking:                  boolean;
}

export interface TS6Channel {
  cid:           number;
  pid:           number;
  channel_name:  string;
  total_clients: number;
}

export interface TS6ServerInfo {
  name:            string;
  clients_online:  number;
  channels_online: number;
  uptime:          number;
}

export class TS6RestClient {
  constructor(
    private baseUrl: string,
    private apiKey:  string,
  ) {}

  private async request<T>(
    path:   string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?:  unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'x-api-key':    this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`TS6 API ${method} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getServerInfo(): Promise<TS6ServerInfo> {
    const res = await this.request<{ data: TS6ServerInfo }>('/serverinfo');
    return res.data;
  }

  async getClients(): Promise<TS6Client[]> {
    const res = await this.request<{ data: TS6Client[] }>('/clients');
    return res.data;
  }

  async getChannels(): Promise<TS6Channel[]> {
    const res = await this.request<{ data: TS6Channel[] }>('/channels');
    return res.data;
  }

  async kickClient(clid: number, reason = 'Kicked by bot'): Promise<void> {
    await this.request('/clients/kick', 'POST', { clid, reason, kick_type: 'server' });
  }

  async registerWebhook(url: string, events = ['*']): Promise<void> {
    await this.request('/webhooks', 'POST', { url, events });
  }
}
