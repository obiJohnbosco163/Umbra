declare module 'tweetnacl' {
  export type BoxKeyPair = { publicKey: Uint8Array; secretKey: Uint8Array };
  export const box: {
    keyPair(): BoxKeyPair;
    (message: Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array | null;
    open(box: Uint8Array, nonce: Uint8Array, publicKey: Uint8Array, secretKey: Uint8Array): Uint8Array | null;
    nonceLength: number;
  };
  export const secretbox: {
    (message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
    open(box: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
    nonceLength: number;
    keyLength: number;
  };
  export function randomBytes(length: number): Uint8Array;
}

declare module 'tweetnacl-util' {
  export function encodeBase64(input: Uint8Array): string;
  export function decodeBase64(input: string): Uint8Array;
  export function encodeUTF8(input: Uint8Array): string;
  export function decodeUTF8(input: string): Uint8Array;
}
