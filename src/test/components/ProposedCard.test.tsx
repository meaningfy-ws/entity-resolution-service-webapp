import { describe, expect, it, vi } from 'vitest'

import { ProposedCard } from '../../components/ProposedCard'
import { render, screen } from '../test-utils'

import type { CanonicalEntityPreview } from '../../api/types.gen'

vi.mock('@hooks/useDecisionsLoadingState', () => ({
  useDecisionsLoadingState: () => false
}))

const mockData: CanonicalEntityPreview = {
  cluster_id: 'cluster-1',
  confidence_score: 0.9,
  similarity_score: 0.85,
  top_entities: [
    {
      identified_by: { source_id: 'src-1', request_id: 'e1', entity_type: 'Person' },
      parsed_representation: { name: 'Alice', city: 'Paris' }
    },
    {
      identified_by: { source_id: 'src-1', request_id: 'e2', entity_type: 'Person' },
      parsed_representation: { name: 'Bob', city: 'London' }
    }
  ]
}

describe('ProposedCard', () => {
  it('renders the default title "Proposed Match"', () => {
    render(
      <ProposedCard
        currentEntity={1}
        data={mockData}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByText('Proposed Match')).toBeInTheDocument()
  })

  it('renders a custom title', () => {
    render(
      <ProposedCard
        currentEntity={1}
        data={mockData}
        title="Alternative Match"
        isAlternative
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByText('Alternative Match')).toBeInTheDocument()
  })

  it('shows entity count label', () => {
    render(
      <ProposedCard
        currentEntity={1}
        data={mockData}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByText(/Entity 1 of 2 in cluster/)).toBeInTheDocument()
  })

  it('disables previous button when on first entity', () => {
    render(
      <ProposedCard
        currentEntity={1}
        data={mockData}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()
  })

  it('disables next button when on last entity', () => {
    render(
      <ProposedCard
        currentEntity={2}
        data={mockData}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons[1]).toBeDisabled()
  })

  it('calls onPrevious when previous button is clicked', async () => {
    const onPrevious = vi.fn()
    render(
      <ProposedCard
        currentEntity={2}
        data={mockData}
        isLoading={false}
        onPrevious={onPrevious}
        onNext={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole('button')
    buttons[0].click()
    expect(onPrevious).toHaveBeenCalledOnce()
  })

  it('calls onNext when next button is clicked', async () => {
    const onNext = vi.fn()
    render(
      <ProposedCard
        currentEntity={1}
        data={mockData}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={onNext}
      />
    )
    const buttons = screen.getAllByRole('button')
    buttons[1].click()
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('shows entity attributes from the current entity index', () => {
    render(
      <ProposedCard
        currentEntity={1}
        data={mockData}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders without data', () => {
    render(
      <ProposedCard
        currentEntity={1}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )
    expect(screen.getByText('Proposed Match')).toBeInTheDocument()
  })

  it('includes reference-only fields with empty values', () => {
    render(
      <ProposedCard
        currentEntity={1}
        data={mockData}
        referenceEntityData={{ name: 'Alice', city: 'Paris', address: '123 Main St', country: 'US' }}
        isLoading={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />
    )

    expect(screen.getByText('Address:')).toBeInTheDocument()
    expect(screen.getByText('Country:')).toBeInTheDocument()
    // Missing fields are rendered as empty values on the proposed side.
    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument()
    expect(screen.queryByText('US')).not.toBeInTheDocument()
  })
})
