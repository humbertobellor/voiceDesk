import { vi } from 'vitest'

export const mockSupabaseClient = {
  from: vi.fn((table: string) => ({
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  })),
}

export function createMockSupabaseClient() {
  return mockSupabaseClient
}
