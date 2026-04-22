/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { UserActionDetailPanel } from '../../components/UserActionDetailPanel'
import { createTestQueryClient, fireEvent, render, screen, waitFor } from '../test-utils'

// Interactive tests need staleTime: Infinity to prevent background refetches
// from wiping cached data (the default mock queryFn returns null/empty) while
// the test is still running.
const createStableClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: Infinity },
    mutations: { retry: false }
  }
})

vi.mock('@api/@tanstack/react-query.gen', () => ({
  getSelectedClusterApiV1UserActionsActionIdSelectedClusterGetOptions: vi.fn(
    () => ({
      queryKey: ['selected-cluster'],
      queryFn: vi.fn().mockResolvedValue(null)
    })
  ),
  getCandidatesApiV1UserActionsActionIdCandidatesGetInfiniteOptions: vi.fn(
    () => ({
      queryKey: ['candidates-infinite'],
      queryFn: vi.fn().mockResolvedValue({ results: [], next: null })
    })
  )
}))

vi.mock('@hooks/useDecisionsLoadingState', () => ({
  useDecisionsLoadingState: () => false
}))

const mockAction = {
  id: 'action-001',
  about_entity_mention: {
    identified_by: {
      source_id: 'src-1',
      request_id: 'entity-001',
      entity_type: 'Person'
    },
    parsed_representation: { name: 'Alice Corp', city: 'Paris' }
  },
  candidates: [
    {
      cluster_id: 'cluster-1',
      confidence_score: 0.85,
      similarity_score: 0.8
    }
  ],
  selected_cluster: { cluster_id: 'cluster-1', confidence_score: 0.85, similarity_score: 0.8 },
  action_type: 'ACCEPT_TOP' as const,
  actor: {
    id: 'user-123',
    email: 'admin@ers.local',
  },
  created_at: '2026-03-15T12:00:00Z'
}

const mockSelectedCluster = {
  cluster_id: 'cluster-1',
  confidence_score: 0.85,
  similarity_score: 0.8,
  top_entities: [
    {
      identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' },
      parsed_representation: { name: 'Alice Corp', city: 'Paris' }
    },
    {
      identified_by: { source_id: 's1', request_id: 'e2', entity_type: 'Person' },
      parsed_representation: { name: 'Bob Smith', city: 'London' }
    }
  ]
}

describe('UserActionDetailPanel', () => {
  describe('empty state', () => {
    it('shows "No Action Selected" heading', () => {
      render(<UserActionDetailPanel />)
      expect(screen.getByText('No Action Selected')).toBeInTheDocument()
    })

    it('shows helper text to select an action', () => {
      render(<UserActionDetailPanel />)
      expect(screen.getByText(/Select an action from the list/)).toBeInTheDocument()
    })

    it('renders as a section element', () => {
      render(<UserActionDetailPanel />)
      expect(document.querySelector('section')).toBeTruthy()
    })
  })

  describe('action header', () => {
    it('renders entity display name from parsed_representation', () => {
      render(<UserActionDetailPanel currentAction={mockAction as never} />)
      expect(screen.getAllByText('Alice Corp').length).toBeGreaterThanOrEqual(1)
    })

    it('falls back to request_id when parsed_representation has no name', () => {
      const action = {
        ...mockAction,
        about_entity_mention: {
          identified_by: { source_id: 's1', request_id: 'req-fallback', entity_type: 'Person' },
          parsed_representation: {}
        }
      }
      render(<UserActionDetailPanel currentAction={action as never} />)
      expect(screen.getByText('req-fallback')).toBeInTheDocument()
    })

    it('renders actor email', () => {
      render(<UserActionDetailPanel currentAction={mockAction as never} />)
      expect(screen.getByText(/admin@ers\.local/)).toBeInTheDocument()
    })

    it('shows "Unknown User" when actor email is missing', () => {
      const action = {
        ...mockAction,
        actor: { id: 'u1', email: undefined }
      }
      render(<UserActionDetailPanel currentAction={action as never} />)
      expect(screen.getByText(/Unknown User/)).toBeInTheDocument()
    })
  })

  describe('action type tags', () => {
    it.each([
      { type: 'ACCEPT_TOP' as const, label: 'Accept Top', color: 'green' },
      { type: 'ACCEPT_ALTERNATIVE' as const, label: 'Accept Alternative', color: 'blue' },
      { type: 'REJECT_ALL' as const, label: 'Reject All', color: 'red' },
    ])('renders "$label" tag with $color color for $type', ({ type, label, color }) => {
      render(
        <UserActionDetailPanel
          currentAction={{ ...mockAction, action_type: type } as never}
        />
      )
      const tag = screen.getByText(label).closest('.ant-tag')
      expect(tag).toBeInTheDocument()
      expect(tag).toHaveClass(`ant-tag-${color}`)
    })
  })

  describe('time display', () => {
    it('renders "5m ago" when 5 minutes have passed', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T12:05:00Z'))

      render(<UserActionDetailPanel currentAction={mockAction as never} />)
      expect(screen.getByText('5m ago')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('renders "3h ago" when 3 hours have passed', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-15T15:00:00Z'))

      render(<UserActionDetailPanel currentAction={mockAction as never} />)
      expect(screen.getByText('3h ago')).toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  describe('entity mention card', () => {
    it('renders "Current Entity" card', () => {
      render(<UserActionDetailPanel currentAction={mockAction as never} />)
      expect(screen.getByText('Current Entity')).toBeInTheDocument()
    })

    it('passes entity attributes to EntityCard', () => {
      render(<UserActionDetailPanel currentAction={mockAction as never} />)
      expect(screen.getByText('City:')).toBeInTheDocument()
      expect(screen.getByText('Paris')).toBeInTheDocument()
    })
  })

  describe('selected cluster', () => {
    it('shows "Selected Cluster" ProposedCard when data is in cache', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['selected-cluster'], mockSelectedCluster)

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText('Selected Cluster')).toBeInTheDocument()
      })
    })

    it('shows entity count label from selected cluster', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['selected-cluster'], mockSelectedCluster)

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText('Selected Cluster')).toBeInTheDocument()
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })
    })

    it('shows "No Cluster Selected" fallback for REJECT_ALL', () => {
      render(
        <UserActionDetailPanel
          currentAction={{ ...mockAction, action_type: 'REJECT_ALL', selected_cluster: null } as never}
        />
      )

      expect(screen.getByText('No Cluster Selected')).toBeInTheDocument()
      expect(screen.getByText(/All candidates were rejected/)).toBeInTheDocument()
    })

    it('does not query selected cluster API for REJECT_ALL', async () => {
      const {
        getSelectedClusterApiV1UserActionsActionIdSelectedClusterGetOptions
      } = await import('@api/@tanstack/react-query.gen')

      render(
        <UserActionDetailPanel
          currentAction={{ ...mockAction, action_type: 'REJECT_ALL', selected_cluster: null } as never}
        />
      )

      expect(
        vi.mocked(getSelectedClusterApiV1UserActionsActionIdSelectedClusterGetOptions)
      ).not.toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      )
    })
  })

  describe('candidates', () => {
    it('renders "Candidates" heading', () => {
      render(<UserActionDetailPanel currentAction={mockAction as never} />)
      expect(screen.getByText('Candidates')).toBeInTheDocument()
    })

    it('shows "No candidates available" when candidates list is empty', async () => {
      const queryClient = createTestQueryClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [{ results: [], next: null }],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText('No candidates available')).toBeInTheDocument()
      })
    })

    it('renders candidate collapse items with cluster IDs', async () => {
      const { getCandidatesApiV1UserActionsActionIdCandidatesGetInfiniteOptions } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(
        getCandidatesApiV1UserActionsActionIdCandidatesGetInfiniteOptions
      ).mockReturnValueOnce({
        queryKey: ['candidates-infinite'],
        queryFn: vi.fn().mockResolvedValue({
          results: [
            { cluster_id: 'cluster-1', confidence_score: 0.85, similarity_score: 0.8, top_entities: [] },
            { cluster_id: 'cluster-2', confidence_score: 0.6, similarity_score: 0.55, top_entities: [] }
          ],
          next: null
        })
      } as any)

      const queryClient = createTestQueryClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [
          {
            results: [
              { cluster_id: 'cluster-1', confidence_score: 0.85, similarity_score: 0.8, top_entities: [] },
              { cluster_id: 'cluster-2', confidence_score: 0.6, similarity_score: 0.55, top_entities: [] }
            ],
            next: null
          }
        ],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Candidate 1/)).toBeInTheDocument()
        expect(screen.getByText(/Candidate 2/)).toBeInTheDocument()
      })
    })

    it('renders confidence and similarity score tags on candidate items', async () => {
      const queryClient = createTestQueryClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [
          {
            results: [
              { cluster_id: 'cluster-1', confidence_score: 0.85, similarity_score: 0.8, top_entities: [] }
            ],
            next: null
          }
        ],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText('C: 0.85')).toBeInTheDocument()
        expect(screen.getByText('S: 0.80')).toBeInTheDocument()
      })
    })

    it('expands candidate to show ProposedCard with entity details', async () => {
      const queryClient = createTestQueryClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [
          {
            results: [
              {
                cluster_id: 'cluster-1',
                confidence_score: 0.85,
                similarity_score: 0.8,
                top_entities: [
                  {
                    identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' },
                    parsed_representation: { name: 'Candidate Entity' }
                  }
                ]
              }
            ],
            next: null
          }
        ],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Candidate 1/)).toBeInTheDocument()
      })

      // Expand the candidate collapse
      fireEvent.click(screen.getByText(/Candidate 1/))

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 1/)).toBeInTheDocument()
      })
    })
  })

  describe('selected cluster navigation', () => {
    it('advances to the next entity when forward arrow is clicked', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['selected-cluster'], mockSelectedCluster)

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
      expect(nextBtn).toBeTruthy()
      fireEvent.click(nextBtn!)

      expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()
    })

    it('goes back to the previous entity when back arrow is clicked', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['selected-cluster'], mockSelectedCluster)

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
      fireEvent.click(nextBtn!)
      expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()

      const prevBtn = document.querySelector('[aria-label="arrow-left"]')?.closest('button')
      expect(prevBtn).toBeTruthy()
      fireEvent.click(prevBtn!)
      expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
    })

    it('does not go past the last entity when clicking forward at the end', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['selected-cluster'], mockSelectedCluster)

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
      fireEvent.click(nextBtn!)
      fireEvent.click(nextBtn!)
      // Math.min caps at total entities, so still 2 of 2
      expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()
    })

    it('does not go below the first entity when clicking back at the start', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['selected-cluster'], mockSelectedCluster)

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      const prevBtn = document.querySelector('[aria-label="arrow-left"]')?.closest('button')
      fireEvent.click(prevBtn!)
      // Math.max floors at 1, so still 1 of 2
      expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
    })
  })

  describe('candidate navigation', () => {
    const candidateWithEntities = {
      cluster_id: 'cand-cluster',
      confidence_score: 0.7,
      similarity_score: 0.65,
      top_entities: [
        { identified_by: { source_id: 's1', request_id: 'c1', entity_type: 'Person' }, parsed_representation: { name: 'Cand A' } },
        { identified_by: { source_id: 's1', request_id: 'c2', entity_type: 'Person' }, parsed_representation: { name: 'Cand B' } }
      ]
    }

    it('navigates forward and backward within a candidate cluster', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [{ results: [candidateWithEntities], next: null }],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel
          currentAction={{ ...mockAction, action_type: 'REJECT_ALL', selected_cluster: null } as never}
        />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Candidate 1/)).toBeInTheDocument()
      })

      // Expand the candidate collapse
      fireEvent.click(screen.getByText(/Candidate 1/))

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
      expect(nextBtn).toBeTruthy()
      fireEvent.click(nextBtn!)
      expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()

      const prevBtn = document.querySelector('[aria-label="arrow-left"]')?.closest('button')
      expect(prevBtn).toBeTruthy()
      fireEvent.click(prevBtn!)
      expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
    })

    it('clamps candidate entity index at upper bound when next is clicked past end', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [{ results: [candidateWithEntities], next: null }],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel
          currentAction={{ ...mockAction, action_type: 'REJECT_ALL', selected_cluster: null } as never}
        />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Candidate 1/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Candidate 1/))

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
      fireEvent.click(nextBtn!)
      fireEvent.click(nextBtn!)
      expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()
    })

    it('clamps candidate entity index at lower bound when back is clicked at start', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [{ results: [candidateWithEntities], next: null }],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel
          currentAction={{ ...mockAction, action_type: 'REJECT_ALL', selected_cluster: null } as never}
        />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Candidate 1/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Candidate 1/))

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      const prevBtn = document.querySelector('[aria-label="arrow-left"]')?.closest('button')
      fireEvent.click(prevBtn!)
      expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
    })
  })

  describe('load more candidates', () => {
    it('shows "Load more candidates" when the last page has a next cursor', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [{
          results: [{ cluster_id: 'c-1', confidence_score: 0.5, similarity_score: 0.5, top_entities: [] }],
          next: 2
        }],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText('Load more candidates')).toBeInTheDocument()
      })
    })

    it('hides "Load more candidates" when the last page has no next cursor', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [{
          results: [{ cluster_id: 'c-1', confidence_score: 0.5, similarity_score: 0.5, top_entities: [] }],
          next: null
        }],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Candidate 1/)).toBeInTheDocument()
      })
      expect(screen.queryByText('Load more candidates')).not.toBeInTheDocument()
    })

    it('invokes fetchNextPage when "Load more candidates" is clicked', async () => {
      const { getCandidatesApiV1UserActionsActionIdCandidatesGetInfiniteOptions } =
        await import('@api/@tanstack/react-query.gen')

      const candidatesQueryFn = vi.fn().mockResolvedValue({ results: [], next: null })

      vi.mocked(
        getCandidatesApiV1UserActionsActionIdCandidatesGetInfiniteOptions
      ).mockReturnValue({
        queryKey: ['candidates-infinite'],
        queryFn: candidatesQueryFn
      } as never)

      const queryClient = createStableClient()
      queryClient.setQueryData(['candidates-infinite'], {
        pages: [{
          results: [{ cluster_id: 'c-1', confidence_score: 0.5, similarity_score: 0.5, top_entities: [] }],
          next: 2
        }],
        pageParams: [1]
      })

      render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText('Load more candidates')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Load more candidates'))

      // fetchNextPage should have invoked the queryFn for the next page
      await waitFor(() => {
        expect(candidatesQueryFn).toHaveBeenCalled()
      })
    })
  })

  describe('action change', () => {
    it('resets entity selection back to 1 when a different action is selected', async () => {
      const queryClient = createStableClient()
      queryClient.setQueryData(['selected-cluster'], mockSelectedCluster)

      const { rerender } = render(
        <UserActionDetailPanel currentAction={mockAction as never} />,
        { queryClient }
      )

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })

      // Navigate forward to entity 2
      const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
      fireEvent.click(nextBtn!)
      expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()

      // Switch to a different action — selection should reset to entity 1
      rerender(
        <UserActionDetailPanel
          currentAction={{ ...mockAction, id: 'action-002' } as never}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
      })
    })
  })
})
