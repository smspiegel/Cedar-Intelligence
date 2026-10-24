import { afterEach, describe, expect, it, vi } from 'vitest';
import { CedarApi, CedarApiError } from './client';

describe('CedarApi authentication failures', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a missing session token before making a request', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = new CedarApi('https://api.example.com', async () => null, onUnauthorized);

    await expect(api.listMonitors()).rejects.toThrow(CedarApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports concurrent 401 responses only once', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(
      JSON.stringify({ error: { message: 'Authentication is required' } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )));
    const api = new CedarApi('https://api.example.com', async () => 'expired-token', onUnauthorized);

    await Promise.allSettled([api.listMonitors(), api.listFindings()]);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not end the session for a non-authentication server error', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    const api = new CedarApi('https://api.example.com', async () => 'valid-token', onUnauthorized);

    await expect(api.listMonitors()).rejects.toThrow('Request failed (500)');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('records finding decisions with optimistic concurrency', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { finding: {}, event: {} } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new CedarApi('https://api.example.com', async () => 'valid-token');

    await api.recordFindingEvent('finding/one', 3, { relevance: 'false_positive', workflowState: 'dismissed' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/findings/finding%2Fone/events');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'if-match': '3', authorization: 'Bearer valid-token', 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ relevance: 'false_positive', workflowState: 'dismissed' });
  });
});
