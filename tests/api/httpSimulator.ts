import { EventEmitter } from 'events';
import { Express } from 'express';

export interface SimulatedResponse {
  status: number;
  body: any;
  text: string;
  headers: Record<string, string>;
}

export function simulateRequest(
  app: Express,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<SimulatedResponse> {
  return new Promise((resolve) => {
    const req: any = new EventEmitter();
    req.method = options.method;
    req.url = options.url;
    req.headers = {
      'content-type': 'application/json',
      ...(options.headers || {}),
    };
    req.body = options.body;
    req.query = {};
    req.params = {};

    let resBody: any = '';
    let statusCode: number = 200;
    const resHeaders: Record<string, string> = {};

    const res: any = {
      setHeader(k: string, v: string) {
        resHeaders[k.toLowerCase()] = v;
      },
      getHeader(k: string) {
        return resHeaders[k.toLowerCase()];
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(data: any) {
        resBody = data;
        this.end();
      },
      json(data: any) {
        resHeaders['content-type'] = 'application/json';
        resBody = JSON.stringify(data);
        this.end();
      },
      end() {
        let parsed = resBody;
        if (typeof resBody === 'string' && resHeaders['content-type']?.includes('json')) {
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
        }
        resolve({
          status: statusCode,
          body: parsed,
          text: typeof resBody === 'string' ? resBody : JSON.stringify(resBody),
          headers: resHeaders,
        });
      },
    };

    (app as any).handle(req, res);
  });
}
