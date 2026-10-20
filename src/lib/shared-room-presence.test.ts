import { afterEach, describe, expect, it } from 'vitest'
import { clearRoomPresence, connectedRoomDevices, expireRoomPresence, noteRoomRequest, ROOM_PRESENCE_TIMEOUT_MS } from './shared-room-presence'

const room = 'presence-test-room'
afterEach(() => clearRoomPresence(room))

describe('host connection presence', () => {
  it('shows a device only while its requests are recent', () => {
    noteRoomRequest(room, 'phone-a', 1000)
    expect(connectedRoomDevices(room).has('phone-a')).toBe(true)
    expireRoomPresence(1000 + ROOM_PRESENCE_TIMEOUT_MS)
    expect(connectedRoomDevices(room).has('phone-a')).toBe(false)
  })
  it('refreshes a device after it reconnects', () => {
    noteRoomRequest(room, 'phone-a', 1000)
    expireRoomPresence(1000 + ROOM_PRESENCE_TIMEOUT_MS)
    noteRoomRequest(room, 'phone-a', 20000)
    expect(connectedRoomDevices(room).has('phone-a')).toBe(true)
  })
})
