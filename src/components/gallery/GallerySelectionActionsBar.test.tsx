import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GallerySelectionActionsBar } from './GallerySelectionActionsBar'

describe('GallerySelectionActionsBar', () => {
  it('renders the selected photo count', () => {
    render(
      <GallerySelectionActionsBar
        selectedCount={3}
        isDownloadingPack={false}
        onShare={() => {}}
        onDownload={() => {}}
      />
    )
    expect(screen.getByText(/3 photos selected/)).toBeInTheDocument()
  })

  it('uses singular "photo" when count is 1', () => {
    render(
      <GallerySelectionActionsBar
        selectedCount={1}
        isDownloadingPack={false}
        onShare={() => {}}
        onDownload={() => {}}
      />
    )
    expect(screen.getByText(/^1 photo selected/)).toBeInTheDocument()
  })

  it('invokes onShare when "Copy link" is clicked', () => {
    const onShare = vi.fn()
    render(
      <GallerySelectionActionsBar
        selectedCount={2}
        isDownloadingPack={false}
        onShare={onShare}
        onDownload={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('invokes onDownload when "Download zip" is clicked', () => {
    const onDownload = vi.fn()
    render(
      <GallerySelectionActionsBar
        selectedCount={2}
        isDownloadingPack={false}
        onShare={() => {}}
        onDownload={onDownload}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /download zip/i }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('disables the download button while a download is in progress', () => {
    render(
      <GallerySelectionActionsBar
        selectedCount={2}
        isDownloadingPack={true}
        onShare={() => {}}
        onDownload={() => {}}
      />
    )
    const btn = screen.getByRole('button', { name: /download zip/i })
    expect(btn).toBeDisabled()
  })
})
