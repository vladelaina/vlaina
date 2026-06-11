import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinkEditor } from './LinkEditor';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';

vi.mock('@/lib/i18n', () => ({
    useI18n: () => ({
        t: () => 'URL...',
    }),
}));

const defaultProps = {
    editUrl: '',
    setEditUrl: vi.fn(),
    editText: '',
    setEditText: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isNewLink: true,
    autoFocus: true,
    initialText: 'Link target',
    invalidUrlAttempt: 0,
};

describe('LinkEditor', () => {
    afterEach(() => {
        document.body.replaceChildren();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('focuses the URL textarea as soon as an autofocus editor is mounted', () => {
        render(<LinkEditor {...defaultProps} />);

        expect(screen.getByPlaceholderText('URL...')).toBe(document.activeElement);
    });

    it('does not steal focus for a new link when autofocus is disabled', () => {
        const button = document.createElement('button');
        document.body.append(button);
        button.focus();

        render(<LinkEditor {...defaultProps} autoFocus={false} />);

        expect(document.activeElement).toBe(button);
    });

    it('submits the editor when the check button is clicked', () => {
        const onSave = vi.fn();

        render(
            <LinkEditor
                {...defaultProps}
                editUrl="https://example.com/docs"
                onSave={onSave}
            />
        );

        const button = screen.getByRole('button');
        fireEvent.mouseDown(button);
        fireEvent.click(button);

        expect(onSave).toHaveBeenCalledWith(true);
    });

    it('keeps focus in the URL textarea and shows validation feedback after an invalid save attempt', () => {
        vi.useFakeTimers();
        const { rerender } = render(
            <LinkEditor
                {...defaultProps}
                editUrl="me"
                invalidUrlAttempt={0}
            />
        );

        const input = screen.getByPlaceholderText('URL...');
        rerender(
            <LinkEditor
                {...defaultProps}
                editUrl="me"
                invalidUrlAttempt={1}
            />
        );

        expect(input).toBe(document.activeElement);
        expect(input).toHaveClass('error-shake');
        expect(input).toHaveAttribute('aria-invalid', 'true');

        act(() => {
            vi.advanceTimersByTime(themeUiFeedbackTokens.urlRailValidationErrorDurationMs);
        });

        expect(input).not.toHaveClass('error-shake');
        expect(input).not.toHaveAttribute('aria-invalid');
    });
});
