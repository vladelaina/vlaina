import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { selectCodeBlockLineNumbersEnabled } from '@/stores/unified/settings/markdownSettings';
import { MarkdownCodeBlockSettings } from './markdown/MarkdownCodeBlockSettings';

export function MarkdownTab() {
  const showCodeBlockLineNumbers = useUnifiedStore(
    selectCodeBlockLineNumbersEnabled
  );
  const setMarkdownCodeBlockLineNumbers = useUnifiedStore(
    (state) => state.setMarkdownCodeBlockLineNumbers
  );

  return (
    <div className="max-w-3xl pb-10">
      <MarkdownCodeBlockSettings
        showLineNumbers={showCodeBlockLineNumbers}
        onShowLineNumbersChange={setMarkdownCodeBlockLineNumbers}
      />
    </div>
  );
}
