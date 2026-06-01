import {
    clearSessionIdAlias,
    getSessionIdAliasesResolvingTo,
    resolveSessionIdAlias,
} from './sessionIdAliases';

export class RequestManager {
    private controllers = new Map<string, AbortController>();

    private clearAliasesForResolvedSession(sessionId: string, resolvedSessionId: string) {
        clearSessionIdAlias(sessionId);
        for (const aliasSessionId of getSessionIdAliasesResolvingTo(resolvedSessionId)) {
            clearSessionIdAlias(aliasSessionId);
        }
    }

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
            this.clearAliasesForResolvedSession(sessionId, resolvedSessionId);
            return;
        }
        const current = this.controllers.get(resolvedSessionId);
        if (current === controller) {
            this.controllers.delete(resolvedSessionId);
        }
        if (!current || current === controller) {
            this.clearAliasesForResolvedSession(sessionId, resolvedSessionId);
        }
    }

    isCurrent(sessionId: string, controller: AbortController): boolean {
        return this.controllers.get(resolveSessionIdAlias(sessionId)) === controller;
    }

    isGenerating(sessionId: string): boolean {
        return this.controllers.has(resolveSessionIdAlias(sessionId));
    }

    transfer(fromSessionId: string, toSessionId: string) {
        const resolvedFromSessionId = resolveSessionIdAlias(fromSessionId);
        const resolvedToSessionId = resolveSessionIdAlias(toSessionId);
        const sourceSessionIds = Array.from(new Set([fromSessionId, resolvedFromSessionId]));
        const sourceSessionId = sourceSessionIds.find((sessionId) => this.controllers.has(sessionId));
        if (!sourceSessionId) {
            return;
        }
        const controller = this.controllers.get(sourceSessionId);
        if (!controller) return;

        this.controllers.delete(sourceSessionId);
        this.controllers.set(resolvedToSessionId, controller);
    }
}

export const requestManager = new RequestManager();
