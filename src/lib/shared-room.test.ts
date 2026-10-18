import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SHARED_PROTOCOL } from './shared-room-protocol'
const native = vi.hoisted(() => ({ request: vi.fn(), start: vi.fn(), stop: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' }, registerPlugin: () => native }))
const invitation = { protocol: SHARED_PROTOCOL, roomId: 'room-1234', url: 'http://192.168.43.1:32100/room/room-1234', publicKey: 'A'.repeat(392), invitationSecret: 'A'.repeat(44) }
let saved: Map<string, string>
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); saved = new Map()
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) })
})

describe('invitations and reconnect requests', () => {
  it('accepts private Wi-Fi/hotspot addresses but rejects remote, loopback and incompatible invitations', async () => {
    const shared = await import('./shared-room')
    expect(shared.parseInvitation(shared.invitationText(invitation))).toEqual(invitation)
    for (const host of ['8.8.8.8', '127.0.0.1', 'example.com', '192.168.43.1@evil.example']) expect(() => shared.parseInvitation(shared.invitationText({ ...invitation, url: `http://${host}:32100/room/room-1234` }))).toThrow('local Wi-Fi')
    expect(() => shared.parseInvitation(shared.invitationText({ ...invitation, protocol: 100 }))).toThrow('incompatible')
  })
  it('preserves the device approval credentials when rescanning a changed host address', async () => {
    const shared = await import('./shared-room')
    const original = shared.connectInvitation(invitation)
    const reconnected = shared.connectInvitation({ ...invitation, url: 'http://10.0.0.4:1234/room/room-1234' }, 'my-profile')
    expect(reconnected.deviceId).toBe(original.deviceId)
    expect(reconnected.secret).toBe(original.secret)
    expect(reconnected.localProfileId).toBe('my-profile')
  })
  it('retries the identical operation after a network timeout instead of duplicating the card', async () => {
    const shared = await import('./shared-room')
    shared.connectInvitation(invitation)
    native.request.mockRejectedValueOnce(new Error('Network lost')).mockResolvedValueOnce({ ok: true, status: 'approved' })
    await expect(shared.submitJoined({ type: 'record', cardId: 'number-7' }, 3)).rejects.toThrow('Network lost')
    const pending = shared.readJoinedSession()!.pending!
    expect(pending.command).toEqual({ type: 'record', cardId: 'number-7' })
    await shared.submitJoined()
    expect(native.request.mock.calls[1][0].request.operationId).toBe(native.request.mock.calls[0][0].request.operationId)
    expect(shared.readJoinedSession()!.pending).toBeUndefined()
  })
  it('preserves an unconfirmed operation across an app restart and blocks switching rooms', async () => {
    let shared = await import('./shared-room')
    shared.connectInvitation(invitation)
    native.request.mockRejectedValueOnce(new Error('Network lost'))
    await expect(shared.submitJoined({ type: 'record', cardId: 'number-7' }, 3)).rejects.toThrow()
    const id = shared.readJoinedSession()!.pending!.operationId
    vi.resetModules(); shared = await import('./shared-room')
    expect(shared.readJoinedSession()!.pending!.operationId).toBe(id)
    expect(() => shared.connectInvitation({ ...invitation, roomId: 'other-room' })).toThrow('unconfirmed')
  })
  it('clears an explicitly rejected request so the player can review the latest table', async () => {
    const shared = await import('./shared-room')
    shared.connectInvitation(invitation)
    native.request.mockResolvedValue({ ok: false, error: 'The table changed.' })
    const response = await shared.submitJoined({ type: 'bank' }, 4)
    expect(response.ok).toBe(false)
    expect(shared.readJoinedSession()!.pending).toBeUndefined()
  })
  it('serializes action requests behind earlier polls', async () => {
    const shared = await import('./shared-room')
    shared.connectInvitation(invitation)
    let resolvePoll: (value: unknown) => void = () => {}
    native.request.mockImplementationOnce(() => new Promise(resolve => { resolvePoll = resolve })).mockResolvedValueOnce({ ok: true })
    const poll = shared.requestJoined({ type: 'poll' })
    await Promise.resolve()
    const action = shared.submitJoined({ type: 'bank' }, 4)
    await Promise.resolve()
    expect(native.request).toHaveBeenCalledTimes(1)
    resolvePoll({ ok: true })
    await poll; await action
    expect(native.request).toHaveBeenCalledTimes(2)
    expect(native.request.mock.calls.map(call => call[0].request.type)).toEqual(['poll', 'action'])
  })
})
