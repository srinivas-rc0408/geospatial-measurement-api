import { describe, expect, it } from 'vitest'

import { SCROLL_POSITIONS_KEY, startAtTopOnPageLoad } from './scroll'

describe('startAtTopOnPageLoad', () => {
  it('forgets scroll positions saved before the page loaded', () => {
    sessionStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify({ default: 1800 }))
    startAtTopOnPageLoad()
    expect(sessionStorage.getItem(SCROLL_POSITIONS_KEY)).toBeNull()
  })
})
