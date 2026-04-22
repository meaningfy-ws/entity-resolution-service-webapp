import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FilterBar } from '../../components/FilterBar'
import { useQueryUpdate } from '../../hooks/useQueryUpdate'
import { render, screen } from '../test-utils'

const mockUpdateQuery = vi.hoisted(() => vi.fn())

vi.mock('@hooks/useQueryUpdate', () => ({
  useQueryUpdate: vi.fn(() => ({ params: {}, updateQuery: mockUpdateQuery }))
}))

// Replace antd.Select with a native <select> so options can be selected reliably
// in happy-dom (avoids virtual-list rendering issues)
vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>()

  const NativeSelect = ({
    value,
    onChange,
    options,
    ...rest
  }: {
    value?: string
    onChange?: (v: string) => void
    options?: Array<{ label: string; value: string }>
    [key: string]: unknown
  }) => (
    <select
      aria-label={rest['aria-label'] as string | undefined}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options?.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  )

  return { ...antd, Select: NativeSelect }
})

describe('FilterBar', () => {
  beforeEach(() => mockUpdateQuery.mockClear())

  it('renders the Confidence filter label', () => {
    render(<FilterBar />)
    expect(screen.getByText('Confidence:')).toBeInTheDocument()
  })

  it('renders the Sort by filter label', () => {
    render(<FilterBar />)
    expect(screen.getByText('Sort by:')).toBeInTheDocument()
  })

  it('renders the Search filter label', () => {
    render(<FilterBar />)
    expect(screen.getByText('Search:')).toBeInTheDocument()
  })

  it('renders Sort by combobox', () => {
    render(<FilterBar />)
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<FilterBar />)
    expect(
      screen.getByPlaceholderText('Entity name, ID, etc...')
    ).toBeInTheDocument()
  })

  it('calls updateQuery with ordering when Sort by selection changes', async () => {
    render(<FilterBar />)
    await userEvent.selectOptions(
      screen.getByLabelText('Sort by'),
      'Created At (Oldest)'
    )
    expect(mockUpdateQuery).toHaveBeenCalledWith({ ordering: 'created_at' })
  })

  it('calls updateQuery with confidence params when ConfidenceSelect changes', async () => {
    render(<FilterBar />)
    await userEvent.selectOptions(
      screen.getByLabelText('Select Confidence'),
      'Low (0.0-0.4)'
    )
    expect(mockUpdateQuery).toHaveBeenCalledWith({
      confidence_min: 0,
      confidence_max: 0.4
    })
  })

  it('calls updateQuery with similarity params when SimilaritySelect changes', async () => {
    render(<FilterBar />)
    await userEvent.selectOptions(
      screen.getByLabelText('Select Similarity'),
      'High (0.7-1)'
    )
    expect(mockUpdateQuery).toHaveBeenCalledWith({
      similarity_min: 0.7,
      similarity_max: 1
    })
  })

  it('shows the current ordering value from params', () => {
    vi.mocked(useQueryUpdate).mockReturnValueOnce({
      params: { ordering: '-confidence_score' },
      updateQuery: mockUpdateQuery
    })
    render(<FilterBar />)
    expect(screen.getByLabelText('Sort by')).toHaveValue('-confidence_score')
  })

  it('renders ConfidenceSelect with confidenceMin/Max from params', () => {
    vi.mocked(useQueryUpdate).mockReturnValueOnce({
      params: { confidence_min: '0.4', confidence_max: '0.7' },
      updateQuery: mockUpdateQuery
    })
    render(<FilterBar />)
    expect(screen.getByLabelText('Select Confidence')).toHaveValue('Medium (0.4-0.7)')
  })
})

