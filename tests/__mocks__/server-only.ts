// tests/__mocks__/server-only.ts
// Vitest shim for 'server-only' — prevents the throw in test environments.
// In Next.js production builds, 'server-only' throws if imported from client components.
// In Vitest (jsdom/node), we replace it with a no-op so server-side modules are testable.
export {}
