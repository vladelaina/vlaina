import { useGithubSyncStore } from '@/stores/githubSync';

export function useUserAvatar() {
    const { avatarUrl, localAvatarUrl } = useGithubSyncStore();

    return localAvatarUrl || avatarUrl || null;
}
