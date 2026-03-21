export function createColumnHeaderDragDomController() {
  let menuElement: HTMLElement | null = null
  let focusMenuOnNextRender = false
  const controlElements = new Map<number, HTMLElement>()

  const runNextFrame = (run: () => void) => {
    if (typeof window === 'undefined') {
      run()
      return
    }

    window.requestAnimationFrame(run)
  }

  const focusControlElement = (index: number | null) => {
    if (index == null) return
    runNextFrame(() => {
      controlElements.get(index)?.focus()
    })
  }

  const focusFirstMenuItem = () => {
    if (!focusMenuOnNextRender || !menuElement) return

    runNextFrame(() => {
      if (!focusMenuOnNextRender) return
      focusMenuOnNextRender = false
      menuElement
        ?.querySelector<HTMLElement>('[data-role="col-header-drag-menu-item"]')
        ?.focus()
    })
  }

  const setMenuRef = (element: Element | null) => {
    menuElement = element instanceof HTMLElement ? element : null
    if (menuElement) {
      focusFirstMenuItem()
    }
  }

  const setControlRef = (index: number, element: Element | null) => {
    if (element instanceof HTMLElement) {
      controlElements.set(index, element)
      return
    }

    controlElements.delete(index)
  }

  const queueMenuFocus = (enabled: boolean) => {
    focusMenuOnNextRender = enabled
    if (enabled) {
      focusFirstMenuItem()
    }
  }

  const moveMenuFocus = (step: number | 'start' | 'end') => {
    if (!menuElement) return

    const items = Array.from(
      menuElement.querySelectorAll<HTMLElement>(
        '[data-role="col-header-drag-menu-item"]'
      )
    )
    if (items.length === 0) return

    const currentIndex = items.findIndex((item) => item === document.activeElement)
    if (step === 'start') {
      items[0]?.focus()
      return
    }
    if (step === 'end') {
      items[items.length - 1]?.focus()
      return
    }

    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + step + items.length) % items.length
    items[nextIndex]?.focus()
  }

  const isFocusInsideMenu = () => menuElement?.contains(document.activeElement) ?? false

  const clear = () => {
    menuElement = null
    focusMenuOnNextRender = false
    controlElements.clear()
  }

  return {
    clear,
    focusControlElement,
    isFocusInsideMenu,
    moveMenuFocus,
    queueMenuFocus,
    setControlRef,
    setMenuRef,
  }
}
