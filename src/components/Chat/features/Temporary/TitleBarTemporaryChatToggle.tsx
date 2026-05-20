import { TemporaryChatToggle } from './TemporaryChatToggle';
import { useTemporaryTogglePresentation } from './useTemporaryTogglePresentation';

export function TitleBarTemporaryChatToggle() {
  const { showInTitleBar } = useTemporaryTogglePresentation();
  if (!showInTitleBar) return null;

  return <TemporaryChatToggle mode="promote" />;
}
