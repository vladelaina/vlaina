import { describe, expect, it } from 'vitest';
import { buildWebSearchCapabilityAnswer, classifyWebSearchIntent } from './intent';

describe('web search intent', () => {
  it('answers web search capability questions locally', () => {
    expect(classifyWebSearchIntent('你可以联网搜索不')).toEqual({ action: 'answer-capability' });
    expect(buildWebSearchCapabilityAnswer('你可以联网搜索不')).toBe('可以，当前聊天已开启联网搜索。');
  });

  it('prefetches fresh market information instead of waiting for model keywords', () => {
    expect(classifyWebSearchIntent('搜一下今天的金价')).toEqual({
      action: 'prefetch',
      query: '今天的金价',
      reason: 'fresh-info',
    });
  });

  it('does not force-search casual product recognition prompts', () => {
    expect(classifyWebSearchIntent('你知道catime不')).toEqual({ action: 'decide' });
  });

  it('prefetches explicit search requests without relying on entity keywords', () => {
    expect(classifyWebSearchIntent('搜一下catime')).toEqual({
      action: 'prefetch',
      query: 'catime',
      reason: 'explicit-search',
    });
  });

  it('prefetches when a capability-shaped question includes a live search target', () => {
    expect(classifyWebSearchIntent('你可以联网搜索今天金价不')).toEqual({
      action: 'prefetch',
      query: '今天金价',
      reason: 'fresh-info',
    });
  });

  it('prefetches combined capability and explicit search requests', () => {
    expect(classifyWebSearchIntent('你能联网搜索吗？顺便搜一下catime')).toEqual({
      action: 'prefetch',
      query: 'catime',
      reason: 'explicit-search',
    });
  });

  it('does not prefetch empty explicit search commands', () => {
    expect(classifyWebSearchIntent('搜一下')).toEqual({ action: 'decide' });
  });

  it('does not strip meaningful Chinese characters from fresh queries', () => {
    expect(classifyWebSearchIntent('搜一下今天不锈钢价格')).toEqual({
      action: 'prefetch',
      query: '今天不锈钢价格',
      reason: 'fresh-info',
    });
    expect(classifyWebSearchIntent('今天新能源价格')).toEqual({
      action: 'prefetch',
      query: '今天新能源价格',
      reason: 'fresh-info',
    });
  });

  it('handles common English capability and explicit search forms', () => {
    expect(classifyWebSearchIntent('Can you browse the internet?')).toEqual({ action: 'answer-capability' });
    expect(classifyWebSearchIntent('Can you search catime?')).toEqual({
      action: 'prefetch',
      query: 'catime',
      reason: 'explicit-search',
    });
  });

  it('normalizes full-width and zero-width explicit search input', () => {
    expect(classifyWebSearchIntent('ＳＥＡＲＣＨ\u200b ＦＯＲ catime')).toEqual({
      action: 'prefetch',
      query: 'catime',
      reason: 'explicit-search',
    });
  });

  it('cleans markup around explicit search input', () => {
    expect(classifyWebSearchIntent('<b>搜一下</b>catime')).toEqual({
      action: 'prefetch',
      query: 'catime',
      reason: 'explicit-search',
    });
  });

  it('covers simulated capability questions from common user wording', () => {
    const prompts = [
      '可以联网吗？',
      '联网搜索功能有吗',
      '你能联网查资料吗',
      '你可以 web search 吗',
      'Do you have web access?',
    ];

    for (const prompt of prompts) {
      expect(classifyWebSearchIntent(prompt), prompt).toEqual({ action: 'answer-capability' });
    }
  });

  it('answers common multilingual capability questions in the user language', () => {
    const cases = [
      ['¿Puedes buscar en internet?', 'Sí, la búsqueda web está activada en este chat.'],
      ['Pouvez-vous faire une recherche web?', 'Oui, la recherche web est activée dans ce chat.'],
      ['Kannst du im Internet suchen?', 'Ja, die Websuche ist in diesem Chat aktiviert.'],
      ['Puoi cercare online?', 'Sì, la ricerca web è attiva in questa chat.'],
      ['Pode pesquisar na web?', 'Sim, a pesquisa na web está ativada neste chat.'],
      ['Можешь искать в интернете?', 'Да, веб-поиск включен в этом чате.'],
      ['Web検索できますか?', 'はい、このチャットではWeb検索が有効です。'],
      ['웹 검색 가능해?', '네, 현재 채팅에서 웹 검색이 켜져 있습니다.'],
      ['هل يمكنك البحث على الإنترنت؟', 'نعم، البحث على الويب مفعّل في هذه المحادثة.'],
      ['Can you browse the internet?', 'Yes, web search is enabled for this chat.'],
    ] as const;

    for (const [prompt, answer] of cases) {
      expect(classifyWebSearchIntent(prompt), prompt).toEqual({ action: 'answer-capability' });
      expect(buildWebSearchCapabilityAnswer(prompt), prompt).toBe(answer);
    }
  });

  it('covers simulated explicit user search requests', () => {
    expect(classifyWebSearchIntent('帮我搜一下 Catime 官网')).toEqual({
      action: 'prefetch',
      query: 'Catime 官网',
      reason: 'explicit-search',
    });
    expect(classifyWebSearchIntent('Can you search catime release notes?')).toEqual({
      action: 'prefetch',
      query: 'catime release notes',
      reason: 'explicit-search',
    });
    expect(classifyWebSearchIntent('look up OpenAI status page')).toEqual({
      action: 'prefetch',
      query: 'OpenAI status page',
      reason: 'explicit-search',
    });
  });

  it('covers simulated fresh-info questions without explicit search wording', () => {
    expect(classifyWebSearchIntent('现在上海天气怎么样')).toEqual({
      action: 'prefetch',
      query: '现在上海天气怎么样',
      reason: 'fresh-info',
    });
    expect(classifyWebSearchIntent('latest OpenAI release notes')).toEqual({
      action: 'prefetch',
      query: 'latest OpenAI release notes',
      reason: 'fresh-info',
    });
    expect(classifyWebSearchIntent('本周美元人民币汇率')).toEqual({
      action: 'prefetch',
      query: '本周美元人民币汇率',
      reason: 'fresh-info',
    });
  });

  it('does not prefetch simulated non-web-search user requests', () => {
    const prompts = [
      '你知道catime不',
      '解释一下二分搜索',
      '给我写一个搜索框组件',
      'search icon 怎么设计',
      '帮我查一下这段代码有什么问题',
      '今天心情不错，写首诗',
    ];

    for (const prompt of prompts) {
      expect(classifyWebSearchIntent(prompt), prompt).toEqual({ action: 'decide' });
    }
  });

  it('keeps capability-plus-fresh-info combinations searchable', () => {
    expect(classifyWebSearchIntent('你能联网查今天金价吗')).toEqual({
      action: 'prefetch',
      query: '今天金价',
      reason: 'fresh-info',
    });
  });
});
