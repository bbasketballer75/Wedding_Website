/* global process */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'
import ErrorBoundary from './ErrorBoundary'

// Mock console methods to avoid test output noise
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'group').mockImplementation(() => {})
vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

// Component that throws an error
const ThrowError = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Test wrapper with Router
const TestWrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <TestWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      </TestWrapper>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('catches errors and displays error UI', () => {
    render(
      <TestWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </TestWrapper>
    )

    expect(screen.getByText('Oops!')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('We apologize for the inconvenience. An unexpected error occurred.')
    ).toBeInTheDocument()
    expect(screen.getByText('Go Home')).toBeInTheDocument()
  })

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <TestWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </TestWrapper>
    )

    expect(screen.getByText('Error Details')).toBeInTheDocument()

    // Restore original env
    process.env.NODE_ENV = originalEnv
  })

  it('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(
      <TestWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </TestWrapper>
    )

    expect(screen.queryByText('Error Details (Development Only)')).not.toBeInTheDocument()

    // Restore original env
    process.env.NODE_ENV = originalEnv
  })

  it('logs error to console in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <TestWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </TestWrapper>
    )

    // The ErrorLoggingService uses console.group and console.log
    // instead of console.error, so we just verify it was called
    expect(console.group).toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith('Message:', 'Test error')

    // Restore original env
    process.env.NODE_ENV = originalEnv
  })
})
