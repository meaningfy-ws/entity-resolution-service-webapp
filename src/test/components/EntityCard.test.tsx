import { describe, expect, it, vi } from 'vitest'

import { EntityCard } from '../../components/EntityCard'
import { render, screen } from '../test-utils'

vi.mock('@hooks/useDecisionsLoadingState', () => ({
  useDecisionsLoadingState: () => false
}))

describe('EntityCard', () => {
  it('renders the "Current Entity" title', () => {
    render(<EntityCard />)
    expect(screen.getByText('Current Entity')).toBeInTheDocument()
  })

  it('renders without crashing when no props are provided', () => {
    render(<EntityCard />)
    expect(screen.getByText('Current Entity')).toBeInTheDocument()
  })

  it('renders entity attributes from entityData', () => {
    render(<EntityCard entityData={{ name: 'Alice', city: 'Paris' }} />)
    expect(screen.getByText('Name:')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('City:')).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()
  })

  it('shows "No attributes available" when entityData is empty', () => {
    render(<EntityCard entityData={{}} />)
    expect(screen.getByText('No attributes available')).toBeInTheDocument()
  })

  it('renders in comparison mode when compareWith is provided', () => {
    render(
      <EntityCard
        entityData={{ name: 'Alice', email: 'a@example.com' }}
        compareWith={{ name: 'Alice', phone: '123' }}
      />
    )
    expect(screen.getByText('Name:')).toBeInTheDocument()
  })
})
