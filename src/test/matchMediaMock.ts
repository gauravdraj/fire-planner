type ChangeListener = (event: MediaQueryListEvent) => void;

let prefersDark = false;
const mediaQueryLists = new Set<MatchMediaListMock>();

export function installMatchMediaMock() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => {
      const mediaQueryList = new MatchMediaListMock(query);
      mediaQueryLists.add(mediaQueryList);
      return mediaQueryList;
    },
  });
}

export function resetMatchMediaMock() {
  prefersDark = false;
  mediaQueryLists.clear();
}

export function setMockPrefersColorSchemeDark(nextPrefersDark: boolean) {
  prefersDark = nextPrefersDark;

  for (const mediaQueryList of mediaQueryLists) {
    mediaQueryList.emitChange();
  }
}

export function getMockMatchMediaListenerCount(query: string) {
  let count = 0;

  for (const mediaQueryList of mediaQueryLists) {
    if (mediaQueryList.media === query) {
      count += mediaQueryList.listenerCount;
    }
  }

  return count;
}

class MatchMediaListMock implements MediaQueryList {
  readonly media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;
  private readonly listeners = new Set<EventListenerOrEventListenerObject>();
  private readonly legacyListeners = new Set<ChangeListener>();

  constructor(media: string) {
    this.media = media;
  }

  get matches() {
    return this.media === '(prefers-color-scheme: dark)' && prefersDark;
  }

  get listenerCount() {
    return this.listeners.size + this.legacyListeners.size + (this.onchange === null ? 0 : 1);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === 'change' && listener !== null) {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (type === 'change' && listener !== null) {
      this.listeners.delete(listener);
    }
  }

  addListener(listener: ChangeListener) {
    this.legacyListeners.add(listener);
  }

  removeListener(listener: ChangeListener) {
    this.legacyListeners.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners) {
      if (typeof listener === 'function') {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
    }

    return true;
  }

  emitChange() {
    const event = {
      matches: this.matches,
      media: this.media,
    } as MediaQueryListEvent;

    this.onchange?.call(this, event);
    this.dispatchEvent(event);

    for (const listener of this.legacyListeners) {
      listener.call(this, event);
    }
  }
}
