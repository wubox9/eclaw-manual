// p2p/identity.ts — Derive a stable peerId from the device identity

import { DeviceIdentity } from '../device'

export async function getPeerId(): Promise<string> {
  const identity = await DeviceIdentity.getIdentity()
  return identity.deviceId
}
