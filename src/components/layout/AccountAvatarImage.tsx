import React from 'react';

interface AccountAvatarImageProps {
  src: string | null | undefined;
  fallbackSrc: string;
  alt: string;
  className?: string;
}

export function AccountAvatarImage({ src, fallbackSrc, alt, className }: AccountAvatarImageProps) {
  const [hasLoadError, setHasLoadError] = React.useState(false);

  React.useEffect(() => {
    setHasLoadError(false);
  }, [src, fallbackSrc]);

  const displaySrc = src && !hasLoadError ? src : fallbackSrc;

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!hasLoadError) {
          setHasLoadError(true);
        }
      }}
    />
  );
}
