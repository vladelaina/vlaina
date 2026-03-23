import { useAccountSessionStore } from '@/stores/accountSession';

export function useUserAvatar() {
    const { localAvatarUrl } = useAccountSessionStore();

    return localAvatarUrl || null;
}
