import '@testing-library/jest-dom/vitest';

class ResizeObserverMock implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 320;
    const entry: ResizeObserverEntry = {
      borderBoxSize: [resizeObserverSize(width, height)],
      contentBoxSize: [resizeObserverSize(width, height)],
      contentRect: contentRect(width, height),
      devicePixelContentBoxSize: [resizeObserverSize(width, height)],
      target,
    };

    this.callback([entry], this);
  }

  unobserve() {
    // jsdom does not perform layout, so there is no observer state to release.
  }

  disconnect() {
    // jsdom does not perform layout, so there is no observer state to release.
  }
}

globalThis.ResizeObserver = ResizeObserverMock;

function resizeObserverSize(width: number, height: number): ResizeObserverSize {
  return {
    blockSize: height,
    inlineSize: width,
  };
}

function contentRect(width: number, height: number): DOMRectReadOnly {
  return {
    bottom: height,
    height,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}
