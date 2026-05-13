import { describe, expect, it } from 'vitest';
import { getUserFacingAIError, parseHTTPError } from './errors';
import { AIErrorType } from './types';

describe('getUserFacingAIError', () => {
  it('maps fetch failures to the network error message', () => {
    const result = getUserFacingAIError(new TypeError('Failed to fetch'));

    expect(result).toEqual({
      type: AIErrorType.NETWORK_ERROR,
      code: '',
      message: 'Network connection error. Please check your connection and try again.',
    });
  });

  it('preserves detailed direct provider transport failures', () => {
    const result = getUserFacingAIError({
      type: AIErrorType.NETWORK_ERROR,
      message: 'Failed to fetch',
      details: 'OpenAI-compatible chat request to https://api.example.com/v1/chat/completions failed: fetch failed: certificate has expired',
    });

    expect(result).toEqual({
      type: AIErrorType.NETWORK_ERROR,
      code: '',
      message:
        'OpenAI-compatible chat request to https://api.example.com/v1/chat/completions failed: fetch failed: certificate has expired',
    });
  });

  it('maps timeout failures to the timeout message', () => {
    const result = getUserFacingAIError(new Error('The AI request timed out.'));

    expect(result).toEqual({
      type: AIErrorType.TIMEOUT,
      code: '',
      message: 'The request timed out. Please try again later.',
    });
  });

  it('maps managed auth failures to the auth message', () => {
    const result = getUserFacingAIError(new Error('vlaina sign-in required'));

    expect(result).toEqual({
      type: AIErrorType.AUTH_ERROR,
      code: '',
      message: 'Your sign-in session has expired. Please sign in again and try again.',
    });
  });

  it('maps rate limit responses to the rate limit message', () => {
    const result = getUserFacingAIError({ statusCode: 429, message: 'Too many requests' });

    expect(result).toEqual({
      type: AIErrorType.RATE_LIMIT,
      code: '429',
      message: 'Too many requests',
    });
  });

  it('maps channel failures to the unified service message', () => {
    const result = getUserFacingAIError(new Error('No available channel for model test'));

    expect(result).toEqual({
      type: AIErrorType.SERVER_ERROR,
      code: '',
      message: 'No available channel for model test',
    });
  });

  it('preserves detailed invalid request messages', () => {
    const result = getUserFacingAIError(new Error('Managed chat currently supports text-only messages'));

    expect(result).toEqual({
      type: AIErrorType.INVALID_REQUEST,
      code: '',
      message: 'Managed chat currently supports text-only messages',
    });
  });

  it('keeps low-signal server messages normalized to the fallback copy', () => {
    const result = getUserFacingAIError(new Error('Internal server error'));

    expect(result).toEqual({
      type: AIErrorType.SERVER_ERROR,
      code: '',
      message: 'The model service is temporarily unavailable. Please try again later or switch to another model.',
    });
  });

  it('maps desktop transport failures to the network error message', () => {
    const result = getUserFacingAIError('Managed API request failed: error sending request for url (https://api.vlaina.com/v1/models)');

    expect(result).toEqual({
      type: AIErrorType.NETWORK_ERROR,
      code: '',
      message: 'Network connection error. Please check your connection and try again.',
    });
  });

  it('classifies Electron direct provider fetch failures as network errors', () => {
    const result = getUserFacingAIError(
      new Error(
        "Error invoking remote method 'desktop:ai-provider:request:start': Error: AI provider request to https://api.example.com/v1/chat/completions failed before an HTTP response was received: TypeError: fetch failed"
      )
    );

    expect(result).toEqual({
      type: AIErrorType.NETWORK_ERROR,
      code: '',
      message:
        "Error invoking remote method 'desktop:ai-provider:request:start': Error: AI provider request to https://api.example.com/v1/chat/completions failed before an HTTP response was received: TypeError: fetch failed",
    });
  });

  it('maps managed upstream 403 proxy failures to an actionable provider message', () => {
    const result = getUserFacingAIError(
      new Error(
        'Managed API failed with status 403: {"error":{"message":"openai_error","type":"bad_response_status_code","param":"","code":"bad_response_status_code"}}'
      )
    );

    expect(result).toEqual({
      type: AIErrorType.SERVER_ERROR,
      code: '403',
      message:
        'The upstream AI provider rejected this request (HTTP 403). Check the channel API key, model access, account balance, or provider risk controls.',
    });
  });

  it('maps managed session expiry failures to the auth message', () => {
    const result = getUserFacingAIError(new Error('Managed API session expired'));

    expect(result).toEqual({
      type: AIErrorType.AUTH_ERROR,
      code: '',
      message: 'Your sign-in session has expired. Please sign in again and try again.',
    });
  });

  it('localizes managed upstream machine errors', () => {
    const result = getUserFacingAIError(new Error('UPSTREAM_UNAVAILABLE'));

    expect(result).toEqual({
      type: AIErrorType.SERVER_ERROR,
      code: 'upstream_unavailable',
      message: '๑ᵒᯅᵒ๑ My brain needs a tiny breather. Please try again in a moment~',
    });
  });

  it('localizes managed upstream rate limit machine errors', () => {
    const result = getUserFacingAIError(new Error('UPSTREAM_RATE_LIMITED'));

    expect(result).toEqual({
      type: AIErrorType.RATE_LIMIT,
      code: 'upstream_rate_limited',
      message: '๑ᵒᯅᵒ๑ My brain needs a tiny breather. Please try again in a moment~',
    });
  });

  it('preserves managed business 403 reasons instead of treating them as auth failures', () => {
    const result = getUserFacingAIError(
      new Error('Managed API failed with status 403: Points exhausted')
    );

    expect(result).toEqual({
      type: AIErrorType.QUOTA_EXHAUSTED,
      code: '403',
      message: 'Vlaina 托管模型的点数已经用完了。购买会员后可以继续使用官方托管模型；你也可以在 Spark 设置中接入自己的 API 渠道。',
    });
  });

  it('preserves direct business 403 reasons instead of treating them as auth failures', () => {
    const result = getUserFacingAIError({
      statusCode: 403,
      message: 'No active points balance',
    });

    expect(result).toEqual({
      type: AIErrorType.QUOTA_EXHAUSTED,
      code: '403',
      message: 'Vlaina 托管模型的点数已经用完了。购买会员后可以继续使用官方托管模型；你也可以在 Spark 设置中接入自己的 API 渠道。',
    });
  });
});

describe('parseHTTPError', () => {
  it('extracts provider messages from common HTTP error body shapes', () => {
    expect(parseHTTPError(400, { error: 'bad tool call' })).toMatchObject({
      type: AIErrorType.INVALID_REQUEST,
      message: 'bad tool call',
      statusCode: 400,
    });
    expect(parseHTTPError(429, { msg: 'quota reached' })).toMatchObject({
      type: AIErrorType.RATE_LIMIT,
      message: 'quota reached',
      statusCode: 429,
    });
    expect(parseHTTPError(503, { detail: 'maintenance window' })).toMatchObject({
      type: AIErrorType.SERVER_ERROR,
      message: 'maintenance window',
      statusCode: 503,
    });
    expect(parseHTTPError(500, 'raw upstream failure')).toMatchObject({
      type: AIErrorType.SERVER_ERROR,
      message: 'raw upstream failure',
      statusCode: 500,
    });
  });
});
