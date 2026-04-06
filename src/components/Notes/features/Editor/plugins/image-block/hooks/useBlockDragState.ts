import { useSyncExternalStore } from 'react';
import {
    getBlockDragVisualSnapshot,
    subscribeBlockDragVisualState,
} from '../../cursor/blockDragVisualState';

export function useBlockDragState() {
    return useSyncExternalStore(
        subscribeBlockDragVisualState,
        getBlockDragVisualSnapshot,
        () => false,
    );
}
