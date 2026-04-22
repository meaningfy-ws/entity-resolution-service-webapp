import { describe, expect, it, vi } from 'vitest'

import { useDecisionsLoadingState } from '../../hooks/useDecisionsLoadingState'
import { createTestQueryClient, renderHook } from '../test-utils'

vi.mock('@api/index', () => ({
  listDecisionsApiV1CurationDecisionsGetQueryKey: vi.fn(() => ['decisions'])
}))

describe('useDecisionsLoadingState', () => {
  it('returns false when no query is in the cache', () => {
    const { result } = renderHook(() => useDecisionsLoadingState())
    expect(result.current).toBe(false)
  })

  it('returns false when the query state is not pending', () => {
    const queryClient = createTestQueryClient()
    // Set query data (non-pending state)
    queryClient.setQueryData(['decisions'], { pages: [], pageParams: [] })

    const { result } = renderHook(() => useDecisionsLoadingState(), { queryClient })
    expect(result.current).toBe(false)
  })
})
