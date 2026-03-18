import { forwardRef } from 'react';
import type { SVGProps } from 'react';

export const GoogleIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function GoogleIcon(props, ref) {
  return (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" {...props}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.07.72-2.44 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.95H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.3A7.2 7.2 0 0 1 4.9 12c0-.8.13-1.58.37-2.3V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.78 1.28 5.39l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.46-3.46C17.95 1.14 15.23 0 12 0A12 12 0 0 0 1.28 6.61L5.27 9.7c.95-2.84 3.6-4.93 6.73-4.93Z"
      />
    </svg>
  );
});
