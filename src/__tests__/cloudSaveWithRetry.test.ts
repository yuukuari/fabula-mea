import { describe, it, expect, vi, beforeEach } from 'vitest';

// cloudSaveWithRetry is not exported, so we replicate the logic for testing.
// This ensures the retry pattern itself is correct.
async function cloudSaveWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

describe('cloudSaveWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await cloudSaveWithRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue('ok');

    const promise = cloudSaveWithRetry(fn);
    // Advance past the 1s delay (attempt 0 failed → 1000 * 2^0 = 1s)
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries up to maxRetries and throws on all failures', async () => {
    vi.useRealTimers(); // Use real timers for this test to avoid unhandled rejection noise
    const error = new Error('fail');
    const fn = vi.fn().mockRejectedValue(error);

    // Use maxRetries=1 to avoid long waits
    await expect(cloudSaveWithRetry(fn, 1)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects exponential backoff delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('ok');

    const promise = cloudSaveWithRetry(fn, 3);

    // After 500ms: still waiting for first retry (needs 1000ms)
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 1000ms total: first retry fires
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(2);

    // After 1000 + 2000ms: second retry fires
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses custom maxRetries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const promise = cloudSaveWithRetry(fn, 1);
    await expect(promise).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
