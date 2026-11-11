import * as nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

export type IdentityKeyPair = { publicKey: string; secretKey: string };
export type Ciphertext = { ciphertext: string; nonce: string };
export type WrappedKey = { wrappedKey: string; nonce: string; senderPublicKey: string };

export function createIdentity(): IdentityKeyPair {
  const pair = nacl.box.keyPair();
  return { publicKey: encodeBase64(pair.publicKey), secretKey: encodeBase64(pair.secretKey) };
}

export function createFeedKey(): string {
  return encodeBase64(nacl.randomBytes(nacl.secretbox.keyLength));
}

export function encryptTrade(value: unknown, feedKey: string): Ciphertext {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const message = decodeUTF8(JSON.stringify(value));
  const ciphertext = nacl.secretbox(message, nonce, decodeBase64(feedKey));
  return { ciphertext: encodeBase64(ciphertext), nonce: encodeBase64(nonce) };
}

export function decryptTrade<T>(cipher: Ciphertext, feedKey: string): T {
  const opened = nacl.secretbox.open(decodeBase64(cipher.ciphertext), decodeBase64(cipher.nonce), decodeBase64(feedKey));
  if (!opened) throw new Error('Unable to decrypt trade');
  return JSON.parse(encodeUTF8(opened)) as T;
}

export function wrapFeedKey(feedKey: string, followerPublicKey: string, traderSecretKey: string): WrappedKey {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const sender = nacl.box.keyPair();
  const sharedPayload = nacl.box(decodeUTF8(feedKey), nonce, decodeBase64(followerPublicKey), sender.secretKey);
  if (!sharedPayload) throw new Error('Unable to wrap feed key');
  void traderSecretKey;
  return { wrappedKey: encodeBase64(sharedPayload), nonce: encodeBase64(nonce), senderPublicKey: encodeBase64(sender.publicKey) };
}

export function unwrapFeedKey(envelope: WrappedKey, followerSecretKey: string, traderPublicKey: string): string {
  const opened = nacl.box.open(decodeBase64(envelope.wrappedKey), decodeBase64(envelope.nonce), decodeBase64(envelope.senderPublicKey), decodeBase64(followerSecretKey));
  void traderPublicKey;
  if (!opened) throw new Error('Unable to unwrap feed key');
  return encodeUTF8(opened);
}
