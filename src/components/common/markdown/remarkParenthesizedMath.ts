import { math } from 'micromark-extension-math';
import { markdownLineEnding } from 'micromark-util-character';
import type {
  Code,
  Construct,
  Effects,
  State,
  Token,
} from 'micromark-util-types';

const mathTextConstruct = math().text?.[36];
const mathTextResolve = Array.isArray(mathTextConstruct)
  ? mathTextConstruct[0]?.resolve
  : mathTextConstruct?.resolve;

const parenthesizedMathConstruct: Construct = {
  tokenize: tokenizeParenthesizedMath,
  resolve: mathTextResolve,
  previous(code: Code) {
    return code !== 92;
  },
  name: 'parenthesizedMathText',
};

function tokenizeParenthesizedMath(
  effects: Effects,
  ok: State,
  nok: State,
): State {
  let sequenceToken: Token;

  return start;

  function start(code: Code): State {
    effects.enter('mathText');
    effects.enter('mathTextSequence');
    effects.consume(code);
    return open;
  }

  function open(code: Code): State | undefined {
    if (code !== 40) return nok(code);
    effects.consume(code);
    effects.exit('mathTextSequence');
    return between;
  }

  function between(code: Code): State | undefined {
    if (code === null) return nok(code);
    if (code === 92) {
      sequenceToken = effects.enter('mathTextSequence');
      effects.consume(code);
      return close;
    }
    if (code === 32) {
      effects.enter('space');
      effects.consume(code);
      effects.exit('space');
      return between;
    }
    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      return between;
    }

    effects.enter('mathTextData');
    return data(code);
  }

  function data(code: Code): State | undefined {
    if (code === null || code === 32 || code === 92 || markdownLineEnding(code)) {
      effects.exit('mathTextData');
      return between(code);
    }
    effects.consume(code);
    return data;
  }

  function close(code: Code): State | undefined {
    if (code === 41) {
      effects.consume(code);
      effects.exit('mathTextSequence');
      effects.exit('mathText');
      return ok(code);
    }
    if (code === 92) {
      effects.consume(code);
      sequenceToken.type = 'mathTextData';
      return data;
    }

    sequenceToken.type = 'mathTextData';
    return data(code);
  }
}

export function remarkParenthesizedMath(this: any) {
  const data = this.data();
  const extensions = data.micromarkExtensions || (data.micromarkExtensions = []);
  extensions.push({ text: { 92: parenthesizedMathConstruct } });
}
