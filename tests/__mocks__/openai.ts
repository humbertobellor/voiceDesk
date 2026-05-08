// tests/__mocks__/openai.ts
// Vitest manual mock for the 'openai' package.
// Prevents real API calls during unit tests.
// Pattern: same as existing server-only mock pattern in the project.

const mockParse = vi.fn()

const OpenAI = vi.fn().mockImplementation(() => ({
  chat: {
    completions: {
      parse: mockParse,
    },
  },
}))

export default OpenAI
export { mockParse }
