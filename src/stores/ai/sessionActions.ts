import { translate } from '@/lib/i18n'
import { createAIChatSession } from './chatState'
import {
  openNewChat,
  promoteTemporarySession,
  toggleTemporaryChat,
} from './sessionTemporaryActions'
import { forkSessionFromMessage } from './sessionForkActions'
import {
  switchSession,
  updateSession,
} from './sessionNavigationActions'
import {
  clearSessions,
  deleteSession,
} from './sessionDeleteActions'

export {
  MAX_CHAT_SESSION_DELETE_CONCURRENCY,
  MAX_INLINE_IMAGE_ORPHAN_DELETE_CONCURRENCY,
  MAX_INLINE_IMAGE_PERSISTENCE_PENDING_SESSIONS,
} from './sessionInlineImageConstants'

export function createSessionActions() {
  return {
    toggleTemporaryChat,
    openNewChat,
    promoteTemporarySession,
    createSession: (title = translate('chat.newChatTitle')) => createAIChatSession(title),
    forkSessionFromMessage,
    switchSession,
    updateSession,
    deleteSession,
    clearSessions,
  }
}
