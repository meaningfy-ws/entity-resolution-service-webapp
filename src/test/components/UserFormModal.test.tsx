import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserFormModal } from '../../components/UserFormModal'
import { fireEvent, render, screen, waitFor } from '../test-utils'

import type { UserResponse } from '../../api/types.gen'

vi.setConfig({ testTimeout: 20000 })

const mockNotification = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}))

const mockCreateMutate = vi.hoisted(() => vi.fn())
const mockPatchMutate = vi.hoisted(() => vi.fn())

vi.mock('@api/@tanstack/react-query.gen', () => ({
  createUserApiV1UsersPostMutation: vi.fn(() => ({
    mutationFn: mockCreateMutate
  })),
  patchUserApiV1UsersUserIdPatchMutation: vi.fn(() => ({
    mutationFn: mockPatchMutate
  })),
  listUsersApiV1UsersGetQueryKey: vi.fn(() => ['users'])
}))

vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>()
  const AppComponent = antd.App

  return {
    ...antd,
    App: Object.assign(AppComponent, {
      useApp: () => ({ notification: mockNotification })
    })
  }
})

const mockOnCancel = vi.fn()

const mockUser: UserResponse = {
  id: 'u1',
  email: 'alice@example.com',
  is_active: true,
  is_superuser: false,
  is_verified: true,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UserFormModal', () => {
  describe('create mode', () => {
    it('renders "Add User" title when no user data provided', () => {
      render(<UserFormModal onCancel={mockOnCancel} />)
      expect(screen.getByText('Add User')).toBeInTheDocument()
    })

    it('renders email and password input fields', () => {
      render(<UserFormModal onCancel={mockOnCancel} />)
      expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    })

    it('renders Active, Superuser, and Verified switch fields', () => {
      render(<UserFormModal onCancel={mockOnCancel} />)
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Superuser')).toBeInTheDocument()
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })

    it('shows email required validation on empty submit', async () => {
      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(screen.getByText(/Email is required/i)).toBeInTheDocument()
      })
    })

    it('shows password required validation on empty submit', async () => {
      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(screen.getByText(/Password is required/i)).toBeInTheDocument()
      })
    })

    it('shows email format validation for an invalid email', async () => {
      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
        target: { value: 'notanemail' }
      })
      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(screen.getByText(/Enter a valid email/i)).toBeInTheDocument()
      })
    })

    it('shows password min length validation for short password', async () => {
      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
        target: { value: 'test@example.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: '123' }
      })
      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/Password must be at least 8 characters/i)
        ).toBeInTheDocument()
      })
    })

    it('calls createMutation on valid submit', async () => {
      mockCreateMutate.mockResolvedValue({})

      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
        target: { value: 'newuser@example.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'securepass123' }
      })
      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(mockCreateMutate).toHaveBeenCalled()
      })
    })

    it('shows success notification and calls onCancel after create', async () => {
      mockCreateMutate.mockResolvedValue({})

      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
        target: { value: 'newuser@example.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'securepass123' }
      })
      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(mockNotification.success).toHaveBeenCalledWith({
          message: 'User created successfully'
        })
        expect(mockOnCancel).toHaveBeenCalled()
      })
    })

    it('shows error notification when create fails', async () => {
      mockCreateMutate.mockRejectedValue({
        response: { data: { detail: 'Email already exists' } }
      })

      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.change(screen.getByPlaceholderText('user@example.com'), {
        target: { value: 'existing@example.com' }
      })
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'securepass123' }
      })
      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalled()
      })
    })

    it('calls onCancel when cancel button is clicked', () => {
      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('does not call mutation when validation fails', async () => {
      render(<UserFormModal onCancel={mockOnCancel} />)

      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(screen.getByText(/Email is required/i)).toBeInTheDocument()
      })

      expect(mockCreateMutate).not.toHaveBeenCalled()
    })
  })

  describe('edit mode', () => {
    it('renders "Edit User — email" title', () => {
      render(<UserFormModal data={mockUser} onCancel={mockOnCancel} />)
      expect(screen.getByText(`Edit User — ${mockUser.email}`)).toBeInTheDocument()
    })

    it('does not render email', () => {
      render(<UserFormModal data={mockUser} onCancel={mockOnCancel} />)
      expect(screen.queryByPlaceholderText('user@example.com')).not.toBeInTheDocument()
    })

    it('renders Active, Superuser, and Verified switch fields', () => {
      render(<UserFormModal data={mockUser} onCancel={mockOnCancel} />)
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Superuser')).toBeInTheDocument()
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })

    it('pre-fills form switches from user data', () => {
      render(<UserFormModal data={mockUser} onCancel={mockOnCancel} />)

      // alice: is_active=true, is_superuser=false, is_verified=true
      const switches = screen.getAllByRole('switch')
      expect(switches).toHaveLength(3)

      // Active switch should be checked (is_active=true)
      expect(switches[0]).toHaveAttribute('aria-checked', 'true')
      // Superuser switch should be unchecked (is_superuser=false)
      expect(switches[1]).toHaveAttribute('aria-checked', 'false')
      // Verified switch should be checked (is_verified=true)
      expect(switches[2]).toHaveAttribute('aria-checked', 'true')
    })

    it('calls patchMutation on submit', async () => {
      mockPatchMutate.mockResolvedValue({})

      render(<UserFormModal data={mockUser} onCancel={mockOnCancel} />)

      // Wait for useEffect to populate form values
      await waitFor(() => {
        const switches = screen.getAllByRole('switch')
        expect(switches[0]).toHaveAttribute('aria-checked', 'true')
      })

      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(mockPatchMutate).toHaveBeenCalled()
      })
    })

    it('shows success notification and calls onCancel after edit', async () => {
      mockPatchMutate.mockResolvedValue({})

      render(<UserFormModal data={mockUser} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const switches = screen.getAllByRole('switch')
        expect(switches[0]).toHaveAttribute('aria-checked', 'true')
      })

      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(mockNotification.success).toHaveBeenCalledWith({
          message: 'User updated successfully'
        })
        expect(mockOnCancel).toHaveBeenCalled()
      })
    })

    it('shows error notification when edit fails', async () => {
      mockPatchMutate.mockRejectedValue({
        response: { data: { detail: 'Forbidden' } }
      })

      render(<UserFormModal data={mockUser} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const switches = screen.getAllByRole('switch')
        expect(switches[0]).toHaveAttribute('aria-checked', 'true')
      })

      fireEvent.click(screen.getByRole('button', { name: /ok/i }))

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalled()
      })
    })
  })
})
