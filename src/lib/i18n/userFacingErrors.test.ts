import { describe, expect, it } from 'vitest';
import { useUIStore } from '@/stores/uiSlice';
import { normalizeUserFacingErrorMessage } from './userFacingErrors';

describe('normalizeUserFacingErrorMessage', () => {
  it('localizes known user-facing English errors', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeUserFacingErrorMessage('Upload failed')).toBe('上传失败');
    expect(normalizeUserFacingErrorMessage('Only Markdown files can be opened as notes.')).toBe(
      '请选择一个 Markdown 文件。'
    );
    expect(normalizeUserFacingErrorMessage('Target folder must stay inside the opened folder.')).toBe(
      '无法打开所选 Markdown 文件。'
    );
    expect(normalizeUserFacingErrorMessage('Save or discard draft notes before opening another folder')).toBe(
      '打开其他文件夹前请先保存或丢弃草稿笔记。'
    );
    expect(normalizeUserFacingErrorMessage('Failed to open folder location.')).toBe('无法打开文件夹位置。');
    expect(normalizeUserFacingErrorMessage('Failed to open folder')).toBe('无法打开所选文件夹。');
  });

  it('uses a localized fallback when the error is empty', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeUserFacingErrorMessage('', 'notes.exportFailed')).toBe('导出笔记失败。');
  });

  it('keeps unknown diagnostic messages intact', () => {
    useUIStore.setState({ languagePreference: 'zh-CN' });

    expect(normalizeUserFacingErrorMessage('EACCES: permission denied')).toBe('EACCES: permission denied');
    expect(normalizeUserFacingErrorMessage('Disk write failed', 'asset.uploadFailed')).toBe('Disk write failed');
    expect(normalizeUserFacingErrorMessage('Selected file path must be absolute', 'notes.openMarkdownFileFailed')).toBe(
      'Selected file path must be absolute'
    );
  });
});
