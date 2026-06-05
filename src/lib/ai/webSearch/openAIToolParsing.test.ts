import { describe, expect, it } from 'vitest';
import {
  MAX_DSML_TOOL_MARKUP_CHARS,
  extractOpenAIMessageFromJson,
  stripDsmlToolCallMarkup,
} from './openAIToolParsing';

describe('openAIToolParsing', () => {
  it('extracts DeepSeek DSML tool calls from bounded assistant content', () => {
    const content = [
      'intro',
      '<｜｜DSML｜｜tool_calls>',
      '<｜｜DSML｜｜invoke name="web_search">',
      '<｜｜DSML｜｜parameter name="query">vlaina</｜｜DSML｜｜parameter>',
      '</｜｜DSML｜｜invoke>',
      '</｜｜DSML｜｜tool_calls>',
      'answer',
    ].join('\n');

    const message = extractOpenAIMessageFromJson({
      choices: [{ message: { content } }],
    });

    expect(message.content).toBe('intro\n\nanswer');
    expect(message.toolCalls).toEqual([{
      id: 'dsml_0',
      type: 'function',
      function: {
        name: 'web_search',
        arguments: '{"query":"vlaina"}',
      },
    }]);
  });

  it('skips DSML regex extraction for overlong assistant content', () => {
    const content = `${'a'.repeat(MAX_DSML_TOOL_MARKUP_CHARS + 1)}<｜｜DSML｜｜tool_calls>`;
    const message = extractOpenAIMessageFromJson({
      choices: [{ message: { content } }],
    });

    expect(stripDsmlToolCallMarkup(content)).toBe(content);
    expect(message.content).toBe(content);
    expect(message.toolCalls).toEqual([]);
  });
});
