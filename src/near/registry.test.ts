import { describe, expect, it } from 'vitest';
import { formatYoctoNear, isValidTestnetAccountId, parseNearToYocto } from '@/near/registry';

describe('NEAR registry frontend helpers', () => {
  it('converts NEAR to yoctoNEAR without floating-point arithmetic', () => {
    expect(parseNearToYocto('1.000000000000000000000001')).toBe('1000000000000000000000001');
    expect(formatYoctoNear('1500000000000000000000000')).toBe('1.5');
  });

  it('rejects malformed or unsafe subscription prices', () => {
    expect(() => parseNearToYocto('-1')).toThrow();
    expect(() => parseNearToYocto('1e-3')).toThrow();
    expect(() => parseNearToYocto('0.0000000000000000000000001')).toThrow();
  });

  it('accepts testnet account IDs and rejects the wasm checksum as an account ID', () => {
    expect(isValidTestnetAccountId('johnbosco-dev.testnet')).toBe(true);
    expect(isValidTestnetAccountId('Ba2JJafTrrzcyeRsP7GG225tmxAMvw5ndShhE9aSuhq9')).toBe(false);
    expect(isValidTestnetAccountId('bad..account.testnet')).toBe(false);
  });
});
