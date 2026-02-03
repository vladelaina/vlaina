import { useGithubSyncStore } from '@/stores/useGithubSyncStore';

export function useUserAvatar() {
    const { avatarUrl, localAvatarUrl } = useGithubSyncStore();

    return localAvatarUrl || avatarUrl || null;
}
