import { describe, expect, it, vi } from 'vitest'

import { useRemoveDecisionFromCache } from '../../hooks/useRemoveDecisionFromCache'
import { createTestQueryClient, renderHook } from '../test-utils'

vi.mock('@api/index', () => ({
  listDecisionsApiV1CurationDecisionsGetInfiniteQueryKey: vi.fn(() => ['decisions-infinite']),
  getStatisticsApiV1CurationStatsGetQueryKey: vi.fn(() => ['stats'])
}))

const seedDecisions = (
  queryClient: ReturnType<typeof createTestQueryClient>,
  pages: Array<Array<{ id: string }>>
) => {
  queryClient.setQueryData(['decisions-infinite'], {
    pages: pages.map((results) => ({ results, next_cursor: null })),
    pageParams: pages.map((_, i) => i)
  })
}

describe('useRemoveDecisionFromCache', () => {
  it('removes the specified decision from the cached pages', () => {
    const queryClient = createTestQueryClient()
    seedDecisions(queryClient, [[{ id: 'd1' }, { id: 'd2' }]])

    const { result } = renderHook(() => useRemoveDecisionFromCache(), { queryClient })
    result.current('d1')

    const cached = queryClient.getQueryData<{ pages: Array<{ results: Array<{ id: string }> }> }>([
      'decisions-infinite'
    ])
    expect(cached?.pages[0].results.map((r) => r.id)).toEqual(['d2'])
  })

  it('does not remove other decisions when removing one', () => {
    const queryClient = createTestQueryClient()
    seedDecisions(queryClient, [[{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }]])

    const { result } = renderHook(() => useRemoveDecisionFromCache(), { queryClient })
    result.current('d2')

    const cached = queryClient.getQueryData<{ pages: Array<{ results: Array<{ id: string }> }> }>([
      'decisions-infinite'
    ])
    expect(cached?.pages[0].results.map((r) => r.id)).toEqual(['d1', 'd3'])
  })

  it('removes the decision across multiple pages', () => {
    const queryClient = createTestQueryClient()
    seedDecisions(queryClient, [[{ id: 'd1' }], [{ id: 'd2' }, { id: 'd3' }]])

    const { result } = renderHook(() => useRemoveDecisionFromCache(), { queryClient })
    result.current('d2')

    const cached = queryClient.getQueryData<{ pages: Array<{ results: Array<{ id: string }> }> }>([
      'decisions-infinite'
    ])
    expect(cached?.pages[0].results.map((r) => r.id)).toEqual(['d1'])
    expect(cached?.pages[1].results.map((r) => r.id)).toEqual(['d3'])
  })

  it('does nothing when the cache is empty', () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(() => useRemoveDecisionFromCache(), { queryClient })
    expect(() => result.current('d1')).not.toThrow()
  })

  it('invalidates the stats query after removing a decision', () => {
    const queryClient = createTestQueryClient()
    seedDecisions(queryClient, [[{ id: 'd1' }]])

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveDecisionFromCache(), { queryClient })
    result.current('d1')

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['stats'] })
    )
  })
})
