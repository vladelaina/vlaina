import { createMessageActions } from './messageActions'
import { createSessionActions } from './sessionActions'

export function createChatActions() {
  return {
    ...createSessionActions(),
    ...createMessageActions(),
  }
}
