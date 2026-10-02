// Local player and action IDs are not authentication secrets. Keep them available
// in browser guests served over a private HTTP address, where randomUUID may be absent.
export function newLocalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
