// Identity (design §4.10, D-06): a secp256k1 key made in the browser, kept on this device, exportable.
// Each browser session signs with a sub-key derived from the identity key and a per-tab session id, so two tabs never
// write the same feed (S6, T11). The nickname is what other people see; the address is what proves who wrote (T2).
import { Bytes, PrivateKey } from '@ethersphere/bee-js';

const KEY = 'swarmtyp:identity';
const SESSION = 'swarmtyp:session';

export interface Identity { privateKey: string; address: string }

function randomHex(bytes: number) { const b = new Uint8Array(bytes); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); }

export function loadIdentity(): Identity {
  let hex = localStorage.getItem(KEY);
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) { hex = randomHex(32); localStorage.setItem(KEY, hex); }
  return { privateKey: hex, address: new PrivateKey(hex).publicKey().address().toHex() };
}
export function importIdentity(hex: string): Identity {
  hex = hex.trim().replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('an identity key is 64 hex characters');
  localStorage.setItem(KEY, hex);
  return { privateKey: hex, address: new PrivateKey(hex).publicKey().address().toHex() };
}

/** Stable for this tab across reloads (sessionStorage), different in every other tab and device. */
export function sessionId(): string {
  let id = sessionStorage.getItem(SESSION);
  if (!id) { id = randomHex(16); sessionStorage.setItem(SESSION, id); }
  return id;
}

/** Sub-key for this session: keccak256(identity key || session id). Cannot be reversed to the identity key. */
export function sessionKey(identity: Identity, session = sessionId()): Identity {
  const material = new Uint8Array(48);
  material.set(Uint8Array.from(identity.privateKey.match(/../g)!.map((h) => parseInt(h, 16))), 0);
  material.set(Uint8Array.from(session.match(/../g)!.map((h) => parseInt(h, 16))), 32);
  const hex = Bytes.keccak256(material).toHex();
  return { privateKey: hex, address: new PrivateKey(hex).publicKey().address().toHex() };
}

export function shortAddress(address: string) { return address.replace(/^0x/, '').slice(0, 6) + '…' + address.slice(-4); }
