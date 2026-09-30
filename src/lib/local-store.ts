import type { BankerState } from '../game/bankerGame'

const databaseName = 'flip7-mobile-local'
const databaseVersion = 1
const matchesStore = 'matches'
const playersStore = 'players'

export type SavedMatchStatus = 'draft' | 'in-progress' | 'completed'

export type SavedMatch = {
  id: string
  title: string
  status: SavedMatchStatus
  targetScore: number
  playerNames: string[]
  state: BankerState | null
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export type SavedPlayer = {
  id: string
  name: string
  createdAt: number
}

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('This device does not support local match storage.'))
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(databaseName, databaseVersion)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(matchesStore)) database.createObjectStore(matchesStore, { keyPath: 'id' })
        if (!database.objectStoreNames.contains(playersStore)) database.createObjectStore(playersStore, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open local match storage.'))
      request.onblocked = () => reject(new Error('Local match storage is busy. Please close another app window and try again.'))
    }).catch((error) => {
      databasePromise = null
      throw error
    })
  }
  return databasePromise!
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Local storage transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local storage transaction was cancelled.'))
  })
}

export function createLocalId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function listSavedMatches() {
  const database = await openDatabase()
  const transaction = database.transaction(matchesStore, 'readonly')
  const rows = await requestValue(transaction.objectStore(matchesStore).getAll() as IDBRequest<SavedMatch[]>)
  await transactionDone(transaction)
  return rows.sort((left, right) => right.updatedAt - left.updatedAt)
}

export async function getSavedMatch(id: string) {
  const database = await openDatabase()
  const transaction = database.transaction(matchesStore, 'readonly')
  const row = await requestValue(transaction.objectStore(matchesStore).get(id) as IDBRequest<SavedMatch | undefined>)
  await transactionDone(transaction)
  return row ?? null
}

export async function saveMatch(match: SavedMatch) {
  const database = await openDatabase()
  const transaction = database.transaction(matchesStore, 'readwrite')
  transaction.objectStore(matchesStore).put(match)
  await transactionDone(transaction)
}

export async function updateMatch(id: string, updates: Partial<SavedMatch>) {
  const database = await openDatabase()
  const transaction = database.transaction(matchesStore, 'readwrite')
  const store = transaction.objectStore(matchesStore)
  const existing = await requestValue(store.get(id) as IDBRequest<SavedMatch | undefined>)
  if (existing) store.put({ ...existing, ...updates, id, updatedAt: Date.now() })
  await transactionDone(transaction)
}

export async function deleteMatch(id: string) {
  const database = await openDatabase()
  const transaction = database.transaction(matchesStore, 'readwrite')
  transaction.objectStore(matchesStore).delete(id)
  await transactionDone(transaction)
}

export async function listSavedPlayers() {
  const database = await openDatabase()
  const transaction = database.transaction(playersStore, 'readonly')
  const rows = await requestValue(transaction.objectStore(playersStore).getAll() as IDBRequest<SavedPlayer[]>)
  await transactionDone(transaction)
  return rows.sort((left, right) => left.name.localeCompare(right.name))
}

export async function savePlayer(player: SavedPlayer) {
  const database = await openDatabase()
  const transaction = database.transaction(playersStore, 'readwrite')
  transaction.objectStore(playersStore).put(player)
  await transactionDone(transaction)
}

export async function deletePlayer(id: string) {
  const database = await openDatabase()
  const transaction = database.transaction(playersStore, 'readwrite')
  transaction.objectStore(playersStore).delete(id)
  await transactionDone(transaction)
}

export async function getLocalStorageUsage() {
  if (!navigator.storage?.estimate) return null
  const estimate = await navigator.storage.estimate()
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
}
