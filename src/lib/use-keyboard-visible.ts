import { useEffect, useState } from 'react'

function isTypingField(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !element.disabled && /^(text|search|number|email|password|tel|url)$/.test(element.type)
  }
  return element instanceof HTMLElement && element.isContentEditable
}

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    const viewportHeight = () => Math.min(window.innerHeight, viewport?.height ?? window.innerHeight)
    let fullHeight = viewportHeight()
    let focusedAt = 0
    let focusTimer: ReturnType<typeof setTimeout> | undefined
    let blurFrame = 0
    const update = () => {
      const typing = isTypingField(document.activeElement)
      const currentHeight = viewportHeight()
      if (!typing) fullHeight = Math.max(fullHeight, currentHeight)
      setVisible(fullHeight - currentHeight > 120 || (typing && Date.now() - focusedAt < 500))
    }
    const handleFocusIn = () => {
      if (isTypingField(document.activeElement)) {
        focusedAt = Date.now()
        setVisible(true)
        clearTimeout(focusTimer)
        focusTimer = setTimeout(update, 500)
      } else update()
    }
    const resetHeight = () => { fullHeight = viewportHeight(); update() }

    document.addEventListener('focusin', handleFocusIn)
    const handleFocusOut = () => { blurFrame = window.requestAnimationFrame(update) }
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    window.addEventListener('orientationchange', resetHeight)
    return () => {
      clearTimeout(focusTimer)
      window.cancelAnimationFrame(blurFrame)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', resetHeight)
    }
  }, [])

  return visible
}
