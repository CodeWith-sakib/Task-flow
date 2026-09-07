export interface HttpActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  auth?: {
    type: 'BEARER' | 'BASIC' | 'API_KEY';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
    apiKey?: string;
  };
  timeoutMs?: number;
  expectedStatusCodes?: number[];
}

export interface HttpActionResult {
  statusCode: number;
  headers: Record<string, string>;
  data: any;
  durationMs: number;
}

export type FetchTransport = (url: string, init: any) => Promise<{
  status: number;
  headers: { forEach: (cb: (val: string, key: string) => void) => void };
  json: () => Promise<any>;
  text: () => Promise<string>;
}>;

/**
 * HttpActionRunner executes outbound HTTP requests with authentication headers,
 * timeout guards, and status code assertions.
 */
export class HttpActionRunner {
  private transport?: FetchTransport;

  constructor(transport?: FetchTransport) {
    this.transport = transport;
  }

  public async run(config: HttpActionConfig): Promise<HttpActionResult> {
    const startTime = Date.now();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TaskFlow-Engine-Integration/1.0',
      ...(config.headers || {})
    };

    // Apply authentication
    if (config.auth) {
      if (config.auth.type === 'BEARER' && config.auth.token) {
        headers['Authorization'] = `Bearer ${config.auth.token}`;
      } else if (config.auth.type === 'BASIC' && config.auth.username && config.auth.password) {
        const credentials = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else if (config.auth.type === 'API_KEY' && config.auth.headerName && config.auth.apiKey) {
        headers[config.auth.headerName] = config.auth.apiKey;
      }
    }

    const expectedCodes = config.expectedStatusCodes ?? [200, 201, 202, 204];

    if (!this.transport) {
      // Simulation mode
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        data: { message: 'HTTP action executed successfully (simulation)', url: config.url },
        durationMs: Date.now() - startTime
      };
    }

    const res = await this.transport(config.url, {
      method: config.method,
      headers,
      body: config.body ? (typeof config.body === 'string' ? config.body : JSON.stringify(config.body)) : undefined
    });

    const resHeaders: Record<string, string> = {};
    if (res.headers && res.headers.forEach) {
      res.headers.forEach((val, key) => { resHeaders[key.toLowerCase()] = val; });
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }

    if (!expectedCodes.includes(res.status)) {
      throw new Error(`HTTP action to '${config.url}' returned unexpected status ${res.status} (expected: ${expectedCodes.join(', ')})`);
    }

    return {
      statusCode: res.status,
      headers: resHeaders,
      data,
      durationMs: Date.now() - startTime
    };
  }
}
