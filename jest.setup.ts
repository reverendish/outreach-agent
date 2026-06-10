import '@testing-library/jest-dom';

// IntersectionObserver not available in jsdom
global.IntersectionObserver = class IntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
} as unknown as typeof IntersectionObserver;

// ResizeObserver not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  constructor(_callback: ResizeObserverCallback) {}
} as unknown as typeof ResizeObserver;

// Dexie (IndexedDB) — mock the whole db module so tests never touch real storage
jest.mock('@/src/db', () => ({
  db: {
    profiles: { add: jest.fn().mockResolvedValue('mock-id') },
    contacts: { toArray: jest.fn().mockResolvedValue([]) },
    campaigns: { toArray: jest.fn().mockResolvedValue([]) },
  },
  saveSettings: jest.fn(),
  getSettings: jest.fn().mockReturnValue({}),
  newId: jest.fn().mockReturnValue('mock-uuid'),
}));

// next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));
