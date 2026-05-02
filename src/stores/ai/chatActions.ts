import { createMessageActions } from './messageActions'
import { createSessionActions } from './sessionActions'
import { createSessionPrefetchActions } from './sessionPrefetchActions'

export function createChatActions() {
  return {
    ...createSessionActions(),
    ...createSessionPrefetchActions(),
    ...createMessageActions(),
  }
}
