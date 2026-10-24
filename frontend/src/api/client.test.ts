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
});
