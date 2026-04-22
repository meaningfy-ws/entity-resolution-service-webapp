import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { App, ConfigProvider } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfirmationPreferenceProvider } from '../../context/ConfirmationPreferenceContext'

import { Router } from '../../router/routes'

vi.setConfig({ testTimeout: 20000 })

const mockUser = vi.hoisted(() => ({
  current: null as { id: string; email: string; is_superuser: boolean; is_active: boolean; is_verified: boolean } | null
}))

vi.mock('@context/useAuth', () => ({
  useAuth: () => ({
    user: mockUser.current,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn()
  })
}))

vi.mock('@api/@tanstack/react-query.gen', () => ({
  getStatisticsApiV1CurationStatsGetOptions: vi.fn(() => ({
    queryKey: ['stats'],
    queryFn: vi.fn().mockResolvedValue({
      curation: { selected_top: 0, selected_alternative: 0, rejected_all: 0, total_decisions: 0 }
    })
  })),
  getProposedCanonicalEntityApiV1CurationDecisionsDecisionIdProposedCanonicalEntityGetOptions: vi.fn(() => ({
    queryKey: ['proposed-entity'],
    queryFn: vi.fn().mockResolvedValue({ top_entities: [], confidence_score: 0, cluster_id: '', similarity_score: 0 })
  })),
  getAlternativeCanonicalEntitiesApiV1CurationDecisionsDecisionIdAlternativeCanonicalEntitiesGetInfiniteOptions: vi.fn(() => ({
    queryKey: ['alt-clusters'],
    queryFn: vi.fn().mockResolvedValue({ results: [], next: null })
  })),
  acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  assignDecisionApiV1CurationDecisionsDecisionIdAssignPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  listDecisionsApiV1CurationDecisionsGetInfiniteOptions: vi.fn(() => ({
    queryKey: ['decisions'],
    queryFn: vi.fn().mockResolvedValue({ items: [], next_cursor: null })
  })),
  listDecisionsApiV1CurationDecisionsGetInfiniteQueryKey: vi.fn(() => ['decisions-infinite']),
  listDecisionsApiV1CurationDecisionsGetQueryKey: vi.fn(() => ['decisions']),
  getStatisticsApiV1CurationStatsGetQueryKey: vi.fn(() => ['stats']),
  listEntityTypesApiV1CurationEntityTypesGetOptions: vi.fn(() => ({
    queryKey: ['entity-types'],
    queryFn: vi.fn().mockResolvedValue([])
  })),
  listUsersApiV1UsersGetOptions: vi.fn(() => ({
    queryKey: ['users'],
    queryFn: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null })
  })),
  listUsersApiV1UsersGetQueryKey: vi.fn(() => ['users']),
  patchUserApiV1UsersUserIdPatchMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  }))
}))

vi.mock('@hooks/useQueryUpdate', () => ({
  useQueryUpdate: () => ({
    params: { page: 1, per_page: 10 },
    updateQuery: vi.fn()
  })
}))

function renderWithRouter(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false }
    }
  })

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <App>
            <ConfirmationPreferenceProvider>
              <Router />
            </ConfirmationPreferenceProvider>
          </App>
        </ConfigProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser.current = null
})

describe('SuperAdminRoute', () => {
  it('redirects unauthenticated users from /admin to /login', async () => {
    mockUser.current = null

    renderWithRouter(['/admin'])

    await waitFor(() => {
      expect(screen.getByText('Sign in', { selector: 'h3' })).toBeInTheDocument()
    })
  })

  it('redirects non-superuser from /admin to /', async () => {
    mockUser.current = {
      id: 'u1',
      email: 'user@example.com',
      is_superuser: false,
      is_active: true,
      is_verified: true
    }

    renderWithRouter(['/admin'])

    await waitFor(() => {
      // Should be redirected to root (decision review page), not admin
      expect(screen.queryByText('User Management')).not.toBeInTheDocument()
    })
  })

  it('allows superuser to access /admin', async () => {
    mockUser.current = {
      id: 'admin1',
      email: 'admin@example.com',
      is_superuser: true,
      is_active: true,
      is_verified: true
    }

    renderWithRouter(['/admin'])

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument()
    })
  })
})
