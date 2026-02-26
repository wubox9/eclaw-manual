// location.ts — Location tracking with configurable interval

import type { LocationRecord, IntervalOption, LocationTrackerAPI } from './types'

const STORAGE_KEY = 'eclaw-phone_locations'
const INTERVAL_KEY = 'eclaw-phone_location_interval'
const MAX_RECORDS = 720

const INTERVAL_OPTIONS: readonly IntervalOption[] = [
  { label: '5 minutes',  minutes: 5 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour',     minutes: 60 },
  { label: '2 hours',    minutes: 120 },
  { label: '4 hours',    minutes: 240 },
  { label: '8 hours',    minutes: 480 },
  { label: '24 hours',   minutes: 1440 },
] as const

let trackingInterval: ReturnType<typeof setInterval> | null = null
let enabled = false
let intervalMinutes = 60
let toastFn: ((msg: string) => void) | null = null

export function setToastFn(fn: (msg: string) => void): void {
  toastFn = fn
}

function getIntervalMs(): number {
  return intervalMinutes * 60 * 1000
}

function setIntervalMinutes(minutes: number): void {
  intervalMinutes = parseInt(String(minutes), 10) || 60
  localStorage.setItem(INTERVAL_KEY, String(intervalMinutes))
  if (enabled) {
    if (trackingInterval) clearInterval(trackingInterval)
    recordNow()
    trackingInterval = setInterval(recordNow, getIntervalMs())
  }
}

function loadSavedInterval(): void {
  const saved = localStorage.getItem(INTERVAL_KEY)
  if (saved) intervalMinutes = parseInt(saved, 10) || 60
}

function enable(): void {
  if (enabled) return
  if (!('geolocation' in navigator)) return
  loadSavedInterval()
  enabled = true
  recordNow()
  trackingInterval = setInterval(recordNow, getIntervalMs())
}

function disable(): void {
  enabled = false
  if (trackingInterval) {
    clearInterval(trackingInterval)
    trackingInterval = null
  }
}

function setEnabled(val: boolean): void {
  if (val) enable()
  else disable()
}

function recordNow(): void {
  if (!enabled) return
  navigator.geolocation.getCurrentPosition(
    (pos: GeolocationPosition) => {
      const record: LocationRecord = {
        timestamp: new Date().toISOString(),
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude ?? null,
        speed: pos.coords.speed ?? null
      }
      saveRecord(record)
    },
    (err: GeolocationPositionError) => {
      console.warn('Location error:', err.message)
      if (err.code === err.PERMISSION_DENIED) {
        toastFn?.('Location permission denied')
        disable()
      }
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  )
}

function saveRecord(record: LocationRecord): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const records: LocationRecord[] = stored ? JSON.parse(stored) : []
    const updated = [...records, record]
    const trimmed = updated.length > MAX_RECORDS
      ? updated.slice(updated.length - MAX_RECORDS)
      : updated
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (err) {
    console.error('Failed to save location record:', err)
  }
}

function getRecords(): LocationRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function download(): void {
  const records = getRecords()
  if (records.length === 0) {
    toastFn?.('No location records yet')
    return
  }
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eclaw-locations-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const LocationTracker: LocationTrackerAPI = {
  setEnabled,
  setIntervalMinutes,
  getIntervalMinutes: () => intervalMinutes,
  intervalOptions: INTERVAL_OPTIONS,
  recordNow,
  getRecords,
  download
}
