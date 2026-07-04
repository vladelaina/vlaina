import { requireSafeIpcRequestId } from './managedIpcCommon.mjs';
import { createAbortError, raceWithAbort } from './managedIpcErrors.mjs';

const activeManagedJsonRequests = new Map();

function deleteActiveManagedJsonRequest(requestId, controller) {
  if (activeManagedJsonRequests.get(requestId) === controller) {
    activeManagedJsonRequests.delete(requestId);
  }
}

function isCurrentManagedJsonRequest(requestId, controller) {
  return activeManagedJsonRequests.get(requestId) === controller;
}

export function parseOptionalManagedRequestId(requestIdOrPayload, maybePayload, label) {
  if (maybePayload === undefined) {
    return { requestId: null, payload: requestIdOrPayload };
  }

  return {
    requestId: requireSafeIpcRequestId(requestIdOrPayload, label),
    payload: maybePayload,
  };
}

export async function requestManagedJsonWithOptionalCancel(requestManagedJson, requestId, pathname, init) {
  const controller = requestId ? new AbortController() : null;

  if (requestId && controller) {
    activeManagedJsonRequests.get(requestId)?.abort();
    activeManagedJsonRequests.set(requestId, controller);
  }

  try {
    const managedRequest = Promise.resolve(requestManagedJson(pathname, {
      ...init,
      ...(controller ? { signal: controller.signal } : {}),
    }));
    const result = controller
      ? await raceWithAbort(managedRequest, controller.signal)
      : await managedRequest;
    if (requestId && controller && (!isCurrentManagedJsonRequest(requestId, controller) || controller.signal.aborted)) {
      throw createAbortError();
    }
    return result;
  } catch (error) {
    if (requestId && controller && (!isCurrentManagedJsonRequest(requestId, controller) || controller.signal.aborted)) {
      throw createAbortError();
    }
    throw error;
  } finally {
    if (requestId && controller) {
      deleteActiveManagedJsonRequest(requestId, controller);
    }
  }
}

export function cancelManagedJsonRequest(requestId, label) {
  const id = requireSafeIpcRequestId(requestId, label);
  const controller = activeManagedJsonRequests.get(id);
  if (controller) {
    controller.abort();
    deleteActiveManagedJsonRequest(id, controller);
  }
}
