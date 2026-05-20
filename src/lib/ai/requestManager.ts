import { clearSessionIdAlias, resolveSessionIdAlias } from './sessionIdAliases';

export class RequestManager {
    private controllers = new Map<string, AbortController>();

    start(sessionId: string): AbortController {
        const resolvedSessionId = resolveSessionIdAlias(sessionId);
        this.abort(resolvedSessionId);
        const controller = new AbortController();
        this.controllers.set(resolvedSessionId, controller);
        return controller;
    }

    abort(sessionId: string) {
        const resolvedSessionId = resolveSessionIdAlias(sessionId);
        const controller = this.controllers.get(resolvedSessionId);
        if (controller) {
            controller.abort();
            this.controllers.delete(resolvedSessionId);
        }
        clearSessionIdAlias(sessionId);
    }

    finish(sessionId: string, controller?: AbortController) {
        const resolvedSessionId = resolveSessionIdAlias(sessionId);
        if (!controller) {
            this.controllers.delete(resolvedSessionId);
            clearSessionIdAlias(sessionId);
            return;
        }
        const current = this.controllers.get(resolvedSessionId);
        if (current === controller) {
            this.controllers.delete(resolvedSessionId);
            clearSessionIdAlias(sessionId);
        }
    }

    isGenerating(sessionId: string): boolean {
        return this.controllers.has(resolveSessionIdAlias(sessionId));
    }

    transfer(fromSessionId: string, toSessionId: string) {
        const resolvedFromSessionId = resolveSessionIdAlias(fromSessionId);
        const controller = this.controllers.get(resolvedFromSessionId);
        if (!controller) {
            return;
        }

        this.controllers.delete(resolvedFromSessionId);
        this.controllers.set(toSessionId, controller);
    }
}

export const requestManager = new RequestManager();
