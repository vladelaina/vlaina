import { ref, type Ref, type VNodeRef } from 'vue'

type UseTableContentHostOptions = {
  rootRef: Ref<HTMLDivElement | undefined>
  onMount: (div: HTMLElement) => void
  onContentReady: () => void
}

export function useTableContentHost({
  rootRef,
  onMount,
  onContentReady,
}: UseTableContentHostOptions) {
  let mountedContentHost: HTMLElement | undefined
  let contentTableElement: HTMLTableElement | undefined
  const contentMountRef = ref<HTMLDivElement>()
  const contentWrapperRef = ref<HTMLElement>()

  const resolveContentMount = () => {
    const root = rootRef.value
    const currentMount = contentMountRef.value

    if (
      currentMount instanceof HTMLElement &&
      (!(root instanceof HTMLElement) || root.contains(currentMount))
    ) {
      return currentMount
    }

    const nextMount = root?.querySelector('.table-content-host')
    if (nextMount instanceof HTMLDivElement) {
      contentMountRef.value = nextMount
      return nextMount
    }

    return undefined
  }

  const ensureContentTable = () => {
    if (!contentTableElement) {
      contentTableElement = document.createElement('table')
      contentTableElement.className = 'children'
    }

    return contentTableElement
  }

  const attachContentTable = () => {
    const mount = resolveContentMount()
    if (!(mount instanceof HTMLElement)) return undefined

    const table = ensureContentTable()
    if (table.parentElement !== mount) {
      mount.appendChild(table)
    }
    if (contentWrapperRef.value !== table) {
      contentWrapperRef.value = table
    }
    return table
  }

  const ensureContentHost = () => {
    const root = rootRef.value
    const host = attachContentTable()
    if (!(host instanceof HTMLElement)) return false

    const hostContentDom = host.querySelector('[data-content-dom="true"]')
    if (
      hostContentDom instanceof HTMLElement &&
      (!(root instanceof HTMLElement) ||
        (root.contains(host) && root.contains(hostContentDom)))
    ) {
      mountedContentHost = host
      return false
    }

    onMount(host)
    mountedContentHost = host
    return true
  }

  const contentMountFunctionRef: VNodeRef = (div) => {
    if (div == null) {
      contentMountRef.value = undefined
      return
    }

    if (!(div instanceof HTMLDivElement)) return

    contentMountRef.value = div
    const host = attachContentTable()
    if (!(host instanceof HTMLElement)) return

    if (
      mountedContentHost !== host ||
      !host.querySelector('[data-content-dom="true"]')
    ) {
      ensureContentHost()
      onContentReady()
    }
  }

  return {
    contentMountFunctionRef,
    contentWrapperRef,
    ensureContentHost,
  }
}
