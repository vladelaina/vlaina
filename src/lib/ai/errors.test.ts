import { describe, expect, it } from 'vitest';
import { getUserFacingAIError } from './errors';
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
      message: 'Too many requests. Please try again later.',
    });
  });

  it('maps channel failures to the unified service message', () => {
    const result = getUserFacingAIError(new Error('No available channel for model test'));

    expect(result).toEqual({
      type: AIErrorType.SERVER_ERROR,
      code: '',
      message: 'The model service is temporarily unavailable. Please try again later or switch to another model.',
    });
  });
});
