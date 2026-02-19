import { Application } from '../../src/index';
import { simulateRequest } from './httpSimulator';

describe('HTTP REST API Endpoints', () => {
  let appInstance: Application;

  beforeEach(() => {
    appInstance = new Application();
  });

  it('GET /health should return 200 OK and healthy status', async () => {
    const res = await simulateRequest(appInstance.getApp(), {
      method: 'GET',
      url: '/health',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /metrics should return 200 with Prometheus text', async () => {
    const res = await simulateRequest(appInstance.getApp(), {
      method: 'GET',
      url: '/metrics',
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('GET /status should return 200 HTML dashboard', async () => {
    const res = await simulateRequest(appInstance.getApp(), {
      method: 'GET',
      url: '/status',
    });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('TaskFlow Live Engine');
  });

  it('POST /api/tasks should create task and return 201', async () => {
    const res = await simulateRequest(appInstance.getApp(), {
      method: 'POST',
      url: '/api/tasks',
      body: {
        type: 'email_dispatch',
        payload: { recipient: 'dev@test.com' },
        priority: 15,
        maxRetries: 4,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.type).toBe('email_dispatch');
    expect(res.body.priority).toBe(15);
    expect(res.body.maxRetries).toBe(4);
  });

  it('POST /api/tasks should return 400 when missing required fields', async () => {
    const res = await simulateRequest(appInstance.getApp(), {
      method: 'POST',
      url: '/api/tasks',
      body: { type: 'empty' },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('GET /api/tasks/:id should return 200 for existing task and 404 for non-existent', async () => {
    // Create first
    const createRes = await simulateRequest(appInstance.getApp(), {
      method: 'POST',
      url: '/api/tasks',
      body: { type: 'sample', payload: { x: 1 } },
    });
    const created = createRes.body;

    const getRes = await simulateRequest(appInstance.getApp(), {
      method: 'GET',
      url: `/api/tasks/${created.id}`,
    });
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(created.id);

    const notFoundRes = await simulateRequest(appInstance.getApp(), {
      method: 'GET',
      url: '/api/tasks/non_existent_id',
    });
    expect(notFoundRes.status).toBe(404);
  });

  it('GET /api/tasks should return list of tasks and support ?status filter', async () => {
    await simulateRequest(appInstance.getApp(), {
      method: 'POST',
      url: '/api/tasks',
      body: { type: 't1', payload: {} },
    });

    const allRes = await simulateRequest(appInstance.getApp(), {
      method: 'GET',
      url: '/api/tasks',
    });
    expect(allRes.status).toBe(200);
    expect(Array.isArray(allRes.body)).toBe(true);
    expect(allRes.body.length).toBeGreaterThan(0);

    const queuedRes = await simulateRequest(appInstance.getApp(), {
      method: 'GET',
      url: '/api/tasks?status=queued',
    });
    expect(queuedRes.status).toBe(200);
    expect(Array.isArray(queuedRes.body)).toBe(true);
  });
});
