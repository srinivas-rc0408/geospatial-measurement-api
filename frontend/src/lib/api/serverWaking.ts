/**
 * Cold-start detection. The free backend host sleeps when idle; the first request can take up to a
 * minute. Any request still waiting after SLOW_REQUEST_MS counts as "slow", and the UI shows a calm
 * "waking up" banner until every slow request has settled.
 */
import { useSyncExternalStore } from 'react'

export const SLOW_REQUEST_MS = 2500

let slowRequests = 0
const listeners = new Set<() => void>()

function setSlowRequests(count: number) {
  slowRequests = count
  listeners.forEach((listener) => {
    listener()
  })
}

/** Call when a request starts waiting for the server; call the returned function when it settles. */
export function trackServerWait(): () => void {
  let slow = false
  const timer = setTimeout(() => {
    slow = true
    setSlowRequests(slowRequests + 1)
  }, SLOW_REQUEST_MS)
  let done = false
  return () => {
    if (done) return
    done = true
    clearTimeout(timer)
    if (slow) setSlowRequests(slowRequests - 1)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True while at least one request has been waiting longer than SLOW_REQUEST_MS. */
export function useServerWaking(): boolean {
  return useSyncExternalStore(subscribe, () => slowRequests > 0)
}
