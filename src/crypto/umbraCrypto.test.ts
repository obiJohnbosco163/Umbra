import { describe, expect, it } from 'vitest';
import { createFeedKey, createIdentity, decryptTrade, encryptTrade, unwrapFeedKey, wrapFeedKey } from './umbraCrypto';

describe('Umbra browser crypto', () => {
  it('encrypts and decrypts a trade round trip', () => {
    const key = createFeedKey();
    const value = { pair: 'NEAR / USDC', side: 'BUY', size: 12 };
    expect(decryptTrade(encryptTrade(value, key), key)).toEqual(value);
  });

  it('wraps and unwraps a feed key for a follower', () => {
    const trader = createIdentity();
    const follower = createIdentity();
    const feedKey = createFeedKey();
    const envelope = wrapFeedKey(feedKey, follower.publicKey, trader.secretKey);
    expect(unwrapFeedKey(envelope, follower.secretKey, trader.publicKey)).toBe(feedKey);
  });

  it('fails with a wrong feed key', () => {
    const cipher = encryptTrade({ secret: true }, createFeedKey());
    expect(() => decryptTrade(cipher, createFeedKey())).toThrow('Unable to decrypt trade');
  });

  it('keeps rotated epochs cryptographically separate', () => {
    const first = createFeedKey();
    const second = createFeedKey();
    const oldTrade = encryptTrade({ epoch: 1 }, first);
    const newTrade = encryptTrade({ epoch: 2 }, second);
    expect(decryptTrade(oldTrade, first)).toEqual({ epoch: 1 });
    expect(decryptTrade(newTrade, second)).toEqual({ epoch: 2 });
    expect(() => decryptTrade(oldTrade, second)).toThrow();
  });
});
