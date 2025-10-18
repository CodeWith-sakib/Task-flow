import { ResettableEvent } from '../../src/concurrency/ResettableEvent';

describe('ResettableEvent', () => {
  it('should wait when reset and resume when set', async () => {
    const event = new ResettableEvent(false);
    let woke = false;

    event.wait().then(() => { woke = true; });
    expect(woke).toBe(false);

    event.set();
    await new Promise(r => setTimeout(r, 20));
    expect(woke).toBe(true);

    event.reset();
    expect(event.isSet()).toBe(false);
  });
});
