import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AlternativeClusters } from '../../components/AlternativeClusters'
import { createTestQueryClient, fireEvent, render, screen } from '../test-utils'

beforeEach(() => {
  sessionStorage.clear()
})

vi.mock('@api/@tanstack/react-query.gen', () => ({
  getAlternativeCanonicalEntitiesApiV1CurationDecisionsDecisionIdAlternativeCanonicalEntitiesGetInfiniteOptions:
    vi.fn(() => ({
      queryKey: ['alternative-clusters'],
      queryFn: vi.fn().mockResolvedValue({ results: [], next: null })
    })),
  assignDecisionApiV1CurationDecisionsDecisionIdAssignPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  listDecisionsApiV1CurationDecisionsGetInfiniteQueryKey: vi.fn(() => ['decisions-infinite']),
  getStatisticsApiV1CurationStatsGetQueryKey: vi.fn(() => ['stats'])
}))

vi.mock('@hooks/useDecisionsLoadingState', () => ({
  useDecisionsLoadingState: () => false
}))

const mockDecision = {
  id: 'decision-1',
  about_entity_mention: {
    identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' },
    parsed_representation: { name: 'Test Entity' }
  },
  current_placement: { cluster_id: 'c1', confidence_score: 0.8, similarity_score: 0.7 },
  created_at: new Date().toISOString()
}

const clusterPage = (overrides = {}) => ({
  pages: [
    {
      results: [
        {
          cluster_id: 'cluster-1',
          confidence_score: 0.75,
          similarity_score: 0.7,
          top_entities: [
            {
              identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' },
              parsed_representation: { name: 'Alt Entity A' }
            }
          ],
          ...overrides
        }
      ],
      next: null
    }
  ],
  pageParams: [1]
})

describe('AlternativeClusters', () => {
  it('renders the "Load More" button, disabled when no next page', () => {
    render(<AlternativeClusters />)
    const loadMore = screen.getByRole('button', { name: /Load More/i })
    expect(loadMore).toBeInTheDocument()
    expect(loadMore).toBeDisabled()
  })

  it('renders cluster cards with confidence score when data is in cache', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['alternative-clusters'], clusterPage())

    render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

    expect(screen.getByText(/Compare with/)).toBeInTheDocument()
    expect(screen.getByText(/0\.75/)).toBeInTheDocument()
  })

  it('renders "2nd best cluster" label for the first cluster', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['alternative-clusters'], clusterPage())

    render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

    expect(screen.getByText(/Compare with 2nd best cluster/i)).toBeInTheDocument()
  })

  it('renders "Use this cluster instead" button after expanding the cluster panel', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['alternative-clusters'], clusterPage())

    render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

    fireEvent.click(screen.getByText(/Compare with 2nd best cluster/i))

    expect(screen.getByRole('button', { name: /Use this cluster instead/i })).toBeInTheDocument()
  })

  it('renders a confidence tag with the cluster score', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['alternative-clusters'], clusterPage({ confidence_score: 0.92 }))

    render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

    expect(screen.getByText(/0\.92/)).toBeInTheDocument()
  })

  it('navigates between entities within a cluster', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['alternative-clusters'], clusterPage({
      top_entities: [
        { identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' }, parsed_representation: { name: 'Entity A' } },
        { identified_by: { source_id: 's1', request_id: 'e2', entity_type: 'Person' }, parsed_representation: { name: 'Entity B' } }
      ]
    }))

    render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

    fireEvent.click(screen.getByText(/Compare with 2nd best cluster/i))

    // Should start at entity 1
    expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()

    // Click next to go to entity 2
    const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
    expect(nextBtn).toBeTruthy()
    fireEvent.click(nextBtn!)

    expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()

    // Click previous to go back to entity 1
    const prevBtn = document.querySelector('[aria-label="arrow-left"]')?.closest('button')
    expect(prevBtn).toBeTruthy()
    fireEvent.click(prevBtn!)

    expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
  })

  it('opens Popconfirm when "Use this cluster instead" is clicked', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['alternative-clusters'], clusterPage())

    render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

    fireEvent.click(screen.getByText(/Compare with 2nd best cluster/i))
    fireEvent.click(screen.getByRole('button', { name: /Use this cluster instead/i }))

    // The Popconfirm popup should render with OK button
    const okBtn = screen.getAllByRole('button').find((b) => b.textContent === 'OK')
    expect(okBtn).toBeTruthy()
  })

  describe('skip assign confirmation', () => {
    it('does not open Popconfirm when assign skip is enabled', () => {
      sessionStorage.setItem('ere_skip_assign', 'true')

      const queryClient = createTestQueryClient()
      queryClient.setQueryData(['alternative-clusters'], clusterPage())

      render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

      fireEvent.click(screen.getByText(/Compare with 2nd best cluster/i))
      fireEvent.click(screen.getByRole('button', { name: /Use this cluster instead/i }))

      // No OK button should appear because Popconfirm is disabled
      const okBtn = screen.getAllByRole('button').find((b) => b.textContent === 'OK')
      expect(okBtn).toBeUndefined()
    })

    it('does not open Popconfirm when skip-all is enabled', () => {
      sessionStorage.setItem('ere_skip_all', 'true')

      const queryClient = createTestQueryClient()
      queryClient.setQueryData(['alternative-clusters'], clusterPage())

      render(<AlternativeClusters currentDecision={mockDecision as never} />, { queryClient })

      fireEvent.click(screen.getByText(/Compare with 2nd best cluster/i))
      fireEvent.click(screen.getByRole('button', { name: /Use this cluster instead/i }))

      const okBtn = screen.getAllByRole('button').find((b) => b.textContent === 'OK')
      expect(okBtn).toBeUndefined()
    })
  })
})
