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
    const update = () => {
      const typing = isTypingField(document.activeElement)
      const currentHeight = viewportHeight()
      if (!typing) fullHeight = Math.max(fullHeight, currentHeight)
      setVisible(typing && fullHeight - currentHeight > 120)
    }
    const resetHeight = () => { fullHeight = viewportHeight(); update() }

    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    window.addEventListener('orientationchange', resetHeight)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', resetHeight)
    }
  }, [])

  return visible
}
