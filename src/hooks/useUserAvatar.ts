import { useAccountSessionStore } from '@/stores/accountSession';

export function useUserAvatar() {
    const { avatarUrl, localAvatarUrl } = useAccountSessionStore();

    return localAvatarUrl || avatarUrl || null;
}
