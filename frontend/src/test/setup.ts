import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia; default to a light, motion-enabled system. Tests can override it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

// jsdom does no layout, so there is nothing to observe; components only need the API to exist.
globalThis.ResizeObserver = class {
  observe = () => undefined
  unobserve = () => undefined
  disconnect = () => undefined
}

// jsdom has no IntersectionObserver. This one never fires on its own (nothing scrolls in jsdom);
// tests call intersectAll() to bring everything "into view".
const observers = new Set<MockIntersectionObserver>()
class MockIntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: number[] = []
  private readonly targets = new Set<Element>()
  private readonly callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    observers.add(this)
  }
  observe = (target: Element) => {
    this.targets.add(target)
  }
  unobserve = (target: Element) => {
    this.targets.delete(target)
  }
  disconnect = () => {
    this.targets.clear()
    observers.delete(this)
  }
  takeRecords = () => []
  intersect() {
    const entries = [...this.targets].map(
      (target) =>
        ({ target, isIntersecting: true, intersectionRatio: 1 }) as unknown as IntersectionObserverEntry,
    )
    if (entries.length) this.callback(entries, this)
  }
}
globalThis.IntersectionObserver = MockIntersectionObserver

export function intersectAll() {
  observers.forEach((observer) => {
    observer.intersect()
  })
}
