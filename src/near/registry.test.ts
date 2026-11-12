import { describe, expect, it } from 'vitest';
import {
  formatYoctoNear,
  getTransactionFailure,
  isValidTestnetAccountId,
  isValidX25519PublicKey,
  parseNearToYocto,
} from '@/near/registry';

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

  it('accepts only Base64 public keys decoding to 32 bytes', () => {
    expect(isValidX25519PublicKey('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')).toBe(true);
    expect(isValidX25519PublicKey('not-a-public-key')).toBe(false);
    expect(isValidX25519PublicKey('AQID')).toBe(false);
  });

  it('preserves contract failure reasons from execution and receipt outcomes', () => {
    expect(
      getTransactionFailure({
        status: { Failure: { error_message: 'Smart contract panicked: handle is already taken' } },
      }),
    ).toBe('Smart contract panicked: handle is already taken');

    expect(
      getTransactionFailure({
        status: { SuccessValue: '' },
        receipts_outcome: [
          { outcome: { status: { Failure: { error_message: 'registration requires exactly 0.02 NEAR' } } } },
        ],
      }),
    ).toBe('registration requires exactly 0.02 NEAR');

    expect(getTransactionFailure({ status: { SuccessValue: '' } })).toBeNull();
    expect(getTransactionFailure({ status: 'Failure' })).toContain('without an error message');
  });
});
