// Mock utilities for testing type-router without browser dependencies

// Type declarations for our mock global objects
export interface MockLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface MockHistory {
  pushState(data: unknown, title: string, url: string): void;
}

export interface MockEventListener {
  (event: string, handler: () => void): void;
}

// Return type for mockGlobalThis
export interface MockGlobalContext {
  mockLocation: MockLocation;
  mockHistory: MockHistory;
  triggerEvent: (event: string) => void;
  reset: () => void;
}

// Mock globalThis for unit tests
export function mockGlobalThis(): MockGlobalContext {
  const mockLocation: MockLocation = {
    pathname: '/',
    search: '',
    hash: '',
  };

  const mockHistory: MockHistory = {
    pushState: (_: unknown, __: string, url: string) => {
      // Don't use new URL() as it decodes the pathname
      // Instead, parse the URL string directly to preserve encoding
      const queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        mockLocation.pathname = url.substring(0, queryIndex);
        mockLocation.search = url.substring(queryIndex);
      } else {
        mockLocation.pathname = url;
        mockLocation.search = '';
      }
    },
  };

  const listeners = new Map<string, Set<() => void>>();

  // Cast to the actual global types to satisfy TypeScript
  // We're mocking the minimal surface area we need for tests
  Object.defineProperty(globalThis, 'location', {
    value: mockLocation as unknown as Location,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'history', {
    value: mockHistory as unknown as History,
    writable: true,
    configurable: true,
  });

  const addListener: MockEventListener = (
    event: string,
    handler: () => void,
  ) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);
  };

  const removeListener: MockEventListener = (
    event: string,
    handler: () => void,
  ) => {
    listeners.get(event)?.delete(handler);
  };

  Object.defineProperty(globalThis, 'addEventListener', {
    value: addListener as unknown as typeof globalThis.addEventListener,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'removeEventListener', {
    value: removeListener as unknown as typeof globalThis.removeEventListener,
    writable: true,
    configurable: true,
  });

  return {
    mockLocation,
    mockHistory,
    triggerEvent: (event: string) => {
      listeners.get(event)?.forEach((handler) => handler());
    },
    reset: () => {
      mockLocation.pathname = '/';
      mockLocation.search = '';
      mockLocation.hash = '';
    },
  };
}
