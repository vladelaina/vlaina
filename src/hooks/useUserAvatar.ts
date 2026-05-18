import { useAccountSessionStore } from '@/stores/accountSession';

export function useUserAvatar() {
    const { provider, avatarUrl, localAvatarUrl } = useAccountSessionStore();

    if (provider !== 'google') {
        return null;
    }

    return localAvatarUrl || avatarUrl || null;
}
