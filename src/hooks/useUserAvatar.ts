import { useGithubSyncStore } from '@/stores/useGithubSyncStore';

/**
 * Hook to get the most appropriate user avatar URL.
 * Prioritizes local cached avatar for offline support and speed.
 */
export function useUserAvatar() {
    const { avatarUrl, localAvatarUrl } = useGithubSyncStore();

    // Logic: Local Cache > Remote URL > Null
    return localAvatarUrl || avatarUrl || null;
}
