import { useMemo, useRef, useState, type DragEvent } from 'react';

function moveProviderIdToTargetIndex(
  providerIds: string[],
  draggedProviderId: string,
  targetProviderId: string
): string[] {
  if (draggedProviderId === targetProviderId) {
    return providerIds;
  }

  const fromIndex = providerIds.indexOf(draggedProviderId);
  const toIndex = providerIds.indexOf(targetProviderId);
  if (fromIndex === -1 || toIndex === -1) {
    return providerIds;
  }

  const nextProviderIds = [...providerIds];
  const [movedProviderId] = nextProviderIds.splice(fromIndex, 1);
  nextProviderIds.splice(toIndex, 0, movedProviderId);
  return nextProviderIds;
}

function areProviderIdsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((providerId, index) => providerId === right[index]);
}

function setTransparentDragImage(dataTransfer: DataTransfer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  dataTransfer.setDragImage(canvas, 0, 0);
}

export function useAIChannelOrder<Provider extends { id: string }>(
  customProviders: Provider[],
  reorderCustomProviders: (providerIds: string[]) => void,
) {
  const [draggingProviderId, setDraggingProviderId] = useState<string | null>(null);
  const [dragOverProviderId, setDragOverProviderId] = useState<string | null>(null);
  const [dragPreviewProviderIds, setDragPreviewProviderIds] = useState<string[] | null>(null);
  const suppressChannelClickUntilRef = useRef(0);
  const dragPreviewProviderIdsRef = useRef<string[] | null>(null);
  const lastDragReorderTargetProviderIdRef = useRef<string | null>(null);

  const orderedCustomProviders = useMemo(() => {
    if (!dragPreviewProviderIds) {
      return customProviders;
    }

    const providerById = new Map(customProviders.map((provider) => [provider.id, provider] as const));
    const orderedProviders = dragPreviewProviderIds
      .map((providerId) => providerById.get(providerId))
      .filter((provider): provider is Provider => !!provider);
    const orderedProviderIds = new Set(orderedProviders.map((provider) => provider.id));
    const missingProviders = customProviders.filter((provider) => !orderedProviderIds.has(provider.id));
    return [...orderedProviders, ...missingProviders];
  }, [customProviders, dragPreviewProviderIds]);

  const clearChannelDragState = () => {
    setDraggingProviderId(null);
    setDragOverProviderId(null);
    setDragPreviewProviderIds(null);
    dragPreviewProviderIdsRef.current = null;
    lastDragReorderTargetProviderIdRef.current = null;
  };

  const commitDragPreviewOrder = (providerIds: string[] | null): boolean => {
    if (!providerIds) {
      return false;
    }

    const currentProviderIds = customProviders.map((provider) => provider.id);
    if (areProviderIdsEqual(providerIds, currentProviderIds)) {
      return false;
    }

    reorderCustomProviders(providerIds);
    return true;
  };

  const previewReorderCustomProviders = (draggedProviderId: string, targetProviderId: string) => {
    if (
      draggedProviderId === targetProviderId ||
      lastDragReorderTargetProviderIdRef.current === targetProviderId
    ) {
      return;
    }

    const currentProviderIds =
      dragPreviewProviderIdsRef.current ?? customProviders.map((provider) => provider.id);
    const nextProviderIds = moveProviderIdToTargetIndex(
      currentProviderIds,
      draggedProviderId,
      targetProviderId
    );

    if (nextProviderIds === currentProviderIds) {
      return;
    }

    dragPreviewProviderIdsRef.current = nextProviderIds;
    lastDragReorderTargetProviderIdRef.current = targetProviderId;
    setDragPreviewProviderIds(nextProviderIds);
  };

  const handleChannelDragStart = (providerId: string, event: DragEvent<HTMLDivElement>) => {
    const initialProviderIds = customProviders.map((provider) => provider.id);
    suppressChannelClickUntilRef.current = 0;
    dragPreviewProviderIdsRef.current = initialProviderIds;
    lastDragReorderTargetProviderIdRef.current = null;
    setDraggingProviderId(providerId);
    setDragOverProviderId(null);
    setDragPreviewProviderIds(initialProviderIds);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', providerId);
    setTransparentDragImage(event.dataTransfer);
  };

  const handleChannelDragEnter = (providerId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggingProviderId && draggingProviderId !== providerId) {
      setDragOverProviderId(providerId);
      previewReorderCustomProviders(draggingProviderId, providerId);
    }
  };

  const handleChannelDragOver = (providerId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggingProviderId && draggingProviderId !== providerId) {
      setDragOverProviderId(providerId);
      previewReorderCustomProviders(draggingProviderId, providerId);
    }
  };

  const handleChannelDrop = (targetProviderId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const draggedProviderId = draggingProviderId || event.dataTransfer.getData('text/plain');
    const previewProviderIds = dragPreviewProviderIdsRef.current;
    const previewMatchesDropTarget = lastDragReorderTargetProviderIdRef.current === targetProviderId;
    suppressChannelClickUntilRef.current = Date.now() + 250;
    if (!draggedProviderId || !previewProviderIds) {
      clearChannelDragState();
      return;
    }
    const nextProviderIds = previewMatchesDropTarget
      ? previewProviderIds
      : moveProviderIdToTargetIndex(previewProviderIds, draggedProviderId, targetProviderId);
    commitDragPreviewOrder(nextProviderIds);
    clearChannelDragState();
  };

  const handleChannelDragEnd = () => {
    const previewProviderIds = dragPreviewProviderIdsRef.current;
    suppressChannelClickUntilRef.current = Date.now() + 250;
    commitDragPreviewOrder(previewProviderIds);
    clearChannelDragState();
  };

  return {
    dragOverProviderId,
    draggingProviderId,
    handleChannelDragEnd,
    handleChannelDragEnter,
    handleChannelDragOver,
    handleChannelDragStart,
    handleChannelDrop,
    isChannelClickSuppressed: () => Date.now() < suppressChannelClickUntilRef.current,
    orderedCustomProviders,
  };
}
