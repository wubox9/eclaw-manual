// device.ts — Device identity management using Web Crypto (Ed25519)

import type {
  DeviceKeyPair,
  DeviceKeyMaterial,
  DeviceAuthParams,
  DeviceAuthResult,
  DeviceIdentityAPI
} from './types'

const DB_NAME = 'eclaw-phone'
const STORE_NAME = 'device'
const KEY_ID = 'identity'

interface StoredIdentity {
  readonly deviceId: string
  readonly publicJwk: JsonWebKey
  readonly privateJwk: JsonWebKey
  readonly createdAt: number
}

let cached: DeviceKeyPair | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function dbGet(db: IDBDatabase): Promise<StoredIdentity | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(KEY_ID)
    req.onsuccess = () => resolve((req.result as StoredIdentity) ?? null)
    req.onerror = () => reject(req.error)
  })
}

function dbPut(db: IDBDatabase, value: StoredIdentity): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, KEY_ID)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function bufToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function deriveDeviceId(publicKeyRaw: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', publicKeyRaw)
  return bufToHex(hash)
}

async function generate(): Promise<DeviceKeyPair> {
  const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair

  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  const deviceId = await deriveDeviceId(publicKeyRaw)

  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

  const record: StoredIdentity = { deviceId, publicJwk, privateJwk, createdAt: Date.now() }

  try {
    const db = await openDB()
    await dbPut(db, record)
    db.close()
  } catch (err) {
    console.warn('Failed to persist device identity:', err)
  }

  const privateKey = await crypto.subtle.importKey('jwk', privateJwk, 'Ed25519', false, ['sign'])
  const publicKey = await crypto.subtle.importKey('jwk', publicJwk, 'Ed25519', false, ['verify'])

  cached = { deviceId, publicKeyRaw: new Uint8Array(publicKeyRaw), privateKey, publicKey }
  return cached
}

async function load(): Promise<DeviceKeyPair> {
  if (cached) return cached

  try {
    const db = await openDB()
    const record = await dbGet(db)
    db.close()

    if (record?.privateJwk && record.publicJwk) {
      const privateKey = await crypto.subtle.importKey('jwk', record.privateJwk, 'Ed25519', false, ['sign'])
      const publicKey = await crypto.subtle.importKey('jwk', record.publicJwk, 'Ed25519', true, ['verify'])
      const publicKeyRaw = await crypto.subtle.exportKey('raw', publicKey)
      const deviceId = await deriveDeviceId(publicKeyRaw)

      cached = { deviceId, publicKeyRaw: new Uint8Array(publicKeyRaw), privateKey, publicKey }
      return cached
    }
  } catch (err) {
    console.warn('Failed to load device identity:', err)
  }

  return generate()
}

interface AuthPayloadParams {
  readonly deviceId: string
  readonly clientId: string
  readonly clientMode: string
  readonly role: string
  readonly scopes: readonly string[]
  readonly signedAtMs: number
  readonly token: string
  readonly nonce: string
}

function buildAuthPayload(params: AuthPayloadParams): string {
  const scopes = params.scopes.join(',')
  const token = params.token || ''
  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce
  ].join('|')
}

async function sign(identity: DeviceKeyPair, payload: string): Promise<string> {
  const encoded = new TextEncoder().encode(payload)
  const signature = await crypto.subtle.sign('Ed25519', identity.privateKey, encoded)
  return bufToBase64Url(signature)
}

async function getIdentity(): Promise<DeviceKeyPair> {
  return load()
}

async function buildDeviceAuth(identity: DeviceKeyPair, params: DeviceAuthParams): Promise<DeviceAuthResult> {
  const signedAt = Date.now()
  const payload = buildAuthPayload({
    deviceId: identity.deviceId,
    clientId: params.clientId,
    clientMode: params.clientMode,
    role: params.role,
    scopes: params.scopes,
    signedAtMs: signedAt,
    token: params.token,
    nonce: params.nonce
  })
  const sig = await sign(identity, payload)

  return {
    id: identity.deviceId,
    publicKey: bufToBase64Url(identity.publicKeyRaw),
    signature: sig,
    signedAt,
    token: params.token,
    nonce: params.nonce
  }
}

async function getKeyMaterial(): Promise<DeviceKeyMaterial | null> {
  await load()
  const db = await openDB()
  const record = await dbGet(db)
  db.close()
  if (!record) return null
  return { publicJwk: record.publicJwk, privateJwk: record.privateJwk }
}

export const DeviceIdentity: DeviceIdentityAPI = { getIdentity, buildDeviceAuth, getKeyMaterial }
