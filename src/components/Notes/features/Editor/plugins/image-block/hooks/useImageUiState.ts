import { useState } from 'react';

interface UseImageUiStateResult {
    height: number | undefined;
    setHeight: React.Dispatch<React.SetStateAction<number | undefined>>;
    isHovered: boolean;
    setIsHovered: React.Dispatch<React.SetStateAction<boolean>>;
    isEditingCaption: boolean;
    setIsEditingCaption: React.Dispatch<React.SetStateAction<boolean>>;
    isActive: boolean;
    setIsActive: React.Dispatch<React.SetStateAction<boolean>>;
    isReady: boolean;
    setIsReady: React.Dispatch<React.SetStateAction<boolean>>;
    naturalRatio: number | null;
    setNaturalRatio: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useImageUiState(initialWidth: string): UseImageUiStateResult {
    const [height, setHeight] = useState<number | undefined>(undefined);
    const [isHovered, setIsHovered] = useState(false);
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [isReady, setIsReady] = useState(initialWidth !== 'auto');
    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

    return {
        height,
        setHeight,
        isHovered,
        setIsHovered,
        isEditingCaption,
        setIsEditingCaption,
        isActive,
        setIsActive,
        isReady,
        setIsReady,
        naturalRatio,
        setNaturalRatio,
    };
}
