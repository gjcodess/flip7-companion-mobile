const mainTabPaths = new Set(['/', '/landing', '/players', '/history', '/settings'])

export function isMainTab(pathname: string) {
  return mainTabPaths.has(pathname)
}

export function androidBackDestination(pathname: string, search: string) {
  if (pathname === '/banker' || pathname === '/vengeance') {
    const roomId = new URLSearchParams(search).get('room')
    if (roomId) return `/room?id=${encodeURIComponent(roomId)}`
  }
  return '/landing'
}

export function dismissTopOverlay() {
  const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'))
  const topDialog = dialogs.at(-1)
  if (topDialog) {
    topDialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    return true
  }

  const overlays = Array.from(document.querySelectorAll<HTMLElement>('.picker-backdrop, .room-menu-backdrop'))
    .filter(overlay => getComputedStyle(overlay).pointerEvents !== 'none')
  const topOverlay = overlays.at(-1)
  if (!topOverlay) return false

  const closeButton = topOverlay.querySelector<HTMLButtonElement>(
    '.close-button, [aria-label="Cancel"], [aria-label^="Close"]'
  )
  if (closeButton) {
    if (!closeButton.disabled) closeButton.click()
  } else {
    topOverlay.click()
  }
  return true
}
