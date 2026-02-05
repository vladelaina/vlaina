import { useState, useEffect } from 'react';

interface UseMenuPositionProps {
  initialPosition: { x: number; y: number };
  menuRef: React.RefObject<HTMLDivElement>;
  padding?: number;
}

export function useMenuPosition({ 
  initialPosition, 
  menuRef, 
  padding = 10 
}: UseMenuPositionProps) {
  const [adjustedPosition, setAdjustedPosition] = useState(initialPosition);

  useEffect(() => {
    if (!menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let newX = initialPosition.x;
    let newY = initialPosition.y;
    
    if (initialPosition.y + menuRect.height > viewportHeight) {
      newY = viewportHeight - menuRect.height - padding;
    }
    
    if (initialPosition.x + menuRect.width > viewportWidth) {
      newX = viewportWidth - menuRect.width - padding;
    }
    
    newY = Math.max(padding, newY);
    newX = Math.max(padding, newX);
    
    setAdjustedPosition({ x: newX, y: newY });
  }, [initialPosition, menuRef, padding]);

  return adjustedPosition;
}
