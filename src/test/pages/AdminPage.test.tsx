import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminPage } from '../../pages/AdminPage'
import { fireEvent, render, screen, waitFor } from '../test-utils'

import type { UserResponse } from '../../api/types.gen'

vi.setConfig({ testTimeout: 20000 })

const mockNotification = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}))

const mockModalConfirm = vi.hoisted(() => vi.fn())
const mockUpdateQuery = vi.hoisted(() => vi.fn())
const mockDeactivateMutate = vi.hoisted(() => vi.fn())

const mockUsers: UserResponse[] = [
  {
    id: 'u1',
    email: 'alice@example.com',
    is_active: true,
    is_superuser: false,
    is_verified: true,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'u2',
    email: 'bob@example.com',
    is_active: false,
    is_superuser: true,
    is_verified: false,
    created_at: '2025-02-20T12:00:00Z',
    updated_at: '2025-02-20T12:00:00Z'
  }
]

vi.mock('@api/@tanstack/react-query.gen', () => ({
  listUsersApiV1UsersGetOptions: vi.fn(() => ({
    queryKey: ['users'],
    queryFn: vi.fn().mockResolvedValue({
      count: 2,
      results: mockUsers,
      next: null,
      previous: null
    })
  })),
  listUsersApiV1UsersGetQueryKey: vi.fn(() => ['users']),
  patchUserApiV1UsersUserIdPatchMutation: vi.fn(() => ({
    mutationFn: mockDeactivateMutate
  })),
  createUserApiV1UsersPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  getStatisticsApiV1CurationStatsGetOptions: vi.fn(() => ({
    queryKey: ['stats'],
    queryFn: vi.fn().mockResolvedValue({
      curation: { selected_top: 0, selected_alternative: 0, rejected_all: 0, total_decisions: 0 }
    })
  }))
}))

vi.mock('@hooks/useQueryUpdate', () => ({
  useQueryUpdate: () => ({
    params: { page: 1, per_page: 10 },
    updateQuery: mockUpdateQuery
  })
}))

vi.mock('@context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin', email: 'admin@example.com', is_superuser: true, is_active: true, is_verified: true },
    isLoading: false,
    logout: vi.fn()
  })
}))

vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>()
  const AppComponent = antd.App
  const ModalComponent = antd.Modal

  return {
    ...antd,
    App: Object.assign(AppComponent, {
      useApp: () => ({ notification: mockNotification })
    }),
    // Modal.confirm is the imperative API; mock it so we can inspect its args
    // and invoke its onOk callback directly in tests.
    Modal: Object.assign(ModalComponent, {
      confirm: mockModalConfirm
    })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminPage', () => {
  describe('page layout', () => {
    it('renders the "User Management" heading', () => {
      render(<AdminPage />)
      expect(screen.getByText('User Management')).toBeInTheDocument()
    })

    it('renders the "Add User" button', () => {
      render(<AdminPage />)
      expect(screen.getByRole('button', { name: /Add User/i })).toBeInTheDocument()
    })

    it('renders the email search input', () => {
      render(<AdminPage />)
      expect(screen.getByPlaceholderText('Search by email')).toBeInTheDocument()
    })

    it('renders all table column headers', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1)
      })

      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Superuser').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Verified').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Created').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Actions').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('user table data', () => {
    it('renders user emails in the table', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
        expect(screen.getByText('bob@example.com')).toBeInTheDocument()
      })
    })

    it('renders Active tags with correct color — green for active, orange for inactive', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      const yesNodes = screen.getAllByText('Yes')
      const noNodes = screen.getAllByText('No')

      // alice: active=Yes(green), superuser=No(orange), verified=Yes(green)
      // bob: active=No(orange), superuser=Yes(green), verified=No(orange)
      // Check that Yes tags are green and No tags are orange
      for (const node of yesNodes) {
        expect(node.closest('.ant-tag')).toHaveClass('ant-tag-green')
      }
      for (const node of noNodes) {
        expect(node.closest('.ant-tag')).toHaveClass('ant-tag-orange')
      }
    })

    it('renders created date formatted via toLocaleDateString', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      const formatted = new Date('2025-01-15T10:00:00Z').toLocaleDateString()
      expect(screen.getByText(formatted)).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('calls updateQuery with email and resets page to 1 when typing', () => {
      render(<AdminPage />)

      fireEvent.change(screen.getByPlaceholderText('Search by email'), {
        target: { value: 'alice' }
      })

      expect(mockUpdateQuery).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice', page: 1 })
      )
    })
  })

  describe('action buttons', () => {
    it('disables deactivate button for already inactive users', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('bob@example.com')).toBeInTheDocument()
      })

      // bob is inactive — his delete button should be disabled
      const disabledDeleteBtns = Array.from(
        document.querySelectorAll('button[disabled]')
      ).filter((btn) => btn.querySelector('.anticon-delete'))
      expect(disabledDeleteBtns.length).toBeGreaterThanOrEqual(1)
    })

    it('enables deactivate button for active users', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      // Find all delete buttons that are NOT disabled
      const enabledDeleteBtns = Array.from(
        document.querySelectorAll('button:not([disabled])')
      ).filter((btn) => btn.querySelector('.anticon-delete'))
      expect(enabledDeleteBtns.length).toBeGreaterThanOrEqual(1)
    })

    it('opens "Add User" modal when Add User button is clicked', async () => {
      render(<AdminPage />)

      fireEvent.click(screen.getByRole('button', { name: /Add User/i }))

      await waitFor(() => {
        // The modal should show "Add User" as its title
        expect(screen.getAllByText('Add User').length).toBeGreaterThanOrEqual(2)
        // Email and password fields should be present in create mode
        expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument()
      })
    })

    it('opens "Edit User" modal with user email when edit button is clicked', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      // Find the edit button in alice's row
      const editBtns = Array.from(
        document.querySelectorAll('button:not([disabled])')
      ).filter((btn) => btn.querySelector('.anticon-edit'))
      expect(editBtns.length).toBeGreaterThanOrEqual(1)

      fireEvent.click(editBtns[0])

      await waitFor(() => {
        expect(screen.getByText('Edit User — alice@example.com')).toBeInTheDocument()
      })

      // Email/password fields should NOT be present in edit mode
      expect(screen.queryByPlaceholderText('user@example.com')).not.toBeInTheDocument()
    })

    it('has edit and deactivate buttons per row', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      const editBtns = document.querySelectorAll('.anticon-edit')
      const deleteBtns = document.querySelectorAll('.anticon-delete')

      // Each user row should have an edit and a deactivate button
      expect(editBtns.length).toBe(2)
      expect(deleteBtns.length).toBe(2)
    })

    it('opens Modal.confirm with the user email when deactivate is clicked', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      const enabledDeleteBtns = Array.from(
        document.querySelectorAll('button:not([disabled])')
      ).filter((btn) => btn.querySelector('.anticon-delete'))
      fireEvent.click(enabledDeleteBtns[0] as HTMLElement)

      expect(mockModalConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Deactivate User',
          content: 'Are you sure you want to deactivate alice@example.com?',
          okText: 'Deactivate',
          okButtonProps: { danger: true }
        })
      )
    })

    it('calls the deactivate mutation with is_active=false when Modal.confirm onOk fires', async () => {
      mockDeactivateMutate.mockResolvedValueOnce({})

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      const enabledDeleteBtns = Array.from(
        document.querySelectorAll('button:not([disabled])')
      ).filter((btn) => btn.querySelector('.anticon-delete'))
      fireEvent.click(enabledDeleteBtns[0] as HTMLElement)

      // Extract onOk from the Modal.confirm call and invoke it directly —
      // this is what clicking the "Deactivate" button would do.
      const confirmArgs = mockModalConfirm.mock.calls[0]?.[0]
      expect(confirmArgs?.onOk).toBeTypeOf('function')

      await confirmArgs.onOk()

      // mutationFn receives (variables, context) — inspect the first arg only
      expect(mockDeactivateMutate).toHaveBeenCalled()
      expect(mockDeactivateMutate.mock.calls[0][0]).toEqual({
        body: { is_active: false },
        path: { user_id: 'u1' }
      })
    })

    it('shows a success notification after successful deactivation', async () => {
      mockDeactivateMutate.mockResolvedValueOnce({})

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      const enabledDeleteBtns = Array.from(
        document.querySelectorAll('button:not([disabled])')
      ).filter((btn) => btn.querySelector('.anticon-delete'))
      fireEvent.click(enabledDeleteBtns[0] as HTMLElement)

      const confirmArgs = mockModalConfirm.mock.calls[0]?.[0]
      await confirmArgs.onOk()

      await waitFor(() => {
        expect(mockNotification.success).toHaveBeenCalledWith({
          message: 'User deactivated successfully'
        })
      })
    })

    it('shows an error notification when deactivation fails', async () => {
      mockDeactivateMutate.mockRejectedValueOnce({
        body: { detail: 'Cannot deactivate superuser' }
      })

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      })

      const enabledDeleteBtns = Array.from(
        document.querySelectorAll('button:not([disabled])')
      ).filter((btn) => btn.querySelector('.anticon-delete'))
      fireEvent.click(enabledDeleteBtns[0] as HTMLElement)

      const confirmArgs = mockModalConfirm.mock.calls[0]?.[0]
      await confirmArgs.onOk().catch(() => {})

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalled()
      })
    })
  })

  describe('pagination', () => {
    it('calls updateQuery when the page size changes', async () => {
      // Use 11 users so pagination is visible (more than 10 per page)
      const manyUsers: UserResponse[] = Array.from({ length: 11 }, (_, i) => ({
        id: `u${i}`,
        email: `user${i}@example.com`,
        is_active: true,
        is_superuser: false,
        is_verified: true,
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z'
      }))

      const { listUsersApiV1UsersGetOptions } = await import(
        '@api/@tanstack/react-query.gen'
      )
      vi.mocked(listUsersApiV1UsersGetOptions).mockReturnValueOnce({
        queryKey: ['users'],
        queryFn: vi.fn().mockResolvedValue({
          count: manyUsers.length,
          results: manyUsers,
          next: null,
          previous: null
        })
      } as never)

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('user0@example.com')).toBeInTheDocument()
      })

      // Find the pagination "next page" button (arrow-right inside li)
      const nextPageBtn = document
        .querySelector('.ant-pagination-next')
        ?.querySelector('button')
      expect(nextPageBtn).toBeTruthy()
      fireEvent.click(nextPageBtn!)

      await waitFor(() => {
        expect(mockUpdateQuery).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        )
      })
    })
  })
})
