import { themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

export function UploadSaveSpinner() {
    return (
        <svg
            aria-hidden="true"
            className="animate-spin w-[var(--vlaina-size-18px)] h-[var(--vlaina-size-18px)] text-current"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
            fill={themeStyleResetTokens.fillNone}
            viewBox={themeIconTokens.viewBoxDefault}
        >
            <circle
                className="opacity-[var(--vlaina-opacity-25)]"
                cx="12"
                cy="12"
                r="10"
                stroke={themeStyleResetTokens.currentColor}
                strokeWidth={themeIconTokens.strokeUploadSpinner}
            />
            <path
                className="opacity-[var(--vlaina-opacity-100)]"
                fill={themeStyleResetTokens.currentColor}
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}
