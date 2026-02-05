import type { LanguageDetector } from '../types';

export const detectClojure: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

  if (/^\(ns\s+[\w.-]+/.test(code)) {
    return 'clojure';
  }

  if (/^\((page|defn|def|defmacro|defprotocol|defrecord|deftype|deftask|defc|defc=)\s+/m.test(code)) {
    return 'clojure';
  }

  if (/\b(MACRO|ENDMACRO|SET|IF|ENDIF|FOREACH|ENDFOREACH|CMAKE_|MESSAGE)\s*\(/i.test(first100Lines)) {
    return null;
  }

  if (/\((set-env!|task-options!|deftask)\s*/.test(code)) {
    return 'clojure';
  }

  if (/^;;/.test(first100Lines) && /^\(/m.test(first100Lines)) {
    return 'clojure';
  }

  if (/^\[:\w+/.test(code)) {
    const hiccupVectors = (code.match(/\[:\w+/g) || []).length;
    if (hiccupVectors >= 2) {
      return 'clojure';
    }
  }

  if (/:\w+/.test(code) && /\(def/.test(code)) {
    if (/^;;/m.test(code) || (code.match(/^\(/gm) || []).length >= 3) {
      return 'clojure';
    }
  }

  if (/^\(->>/.test(code) || /^\(->/.test(code)) {
    return 'clojure';
  }

  if (/^\(reduce\s+\+/.test(code)) {
    return 'clojure';
  }

  if (/\(defn\s+\w+\s+\[/.test(code)) {
    return 'clojure';
  }

  if (/^\{:\w+\s+/.test(code.trim())) {
    if (/:\w+\s+\d+/.test(code) || /:\w+\s+"[^"]+"/. test(code)) {
      return 'clojure';
    }
  }

  if (/^\([\w-]+\s+[\w-]+/.test(firstLine)) {
    const clojureIndicators = [
      /\(map\s+/.test(code),
      /\(filter\s+/.test(code),
      /\(reduce\s+/.test(code),
      /\(let\s+\[/.test(code),
      /\(fn\s+/.test(code),
      /\(if\s+/.test(code),
      /\(when\s+/.test(code),
      /\(doseq\s+/.test(code),
      /\(for\s+\[/.test(code),
      /\(->|->>\s+/.test(code),
      /\[\s*\d+/.test(code) && /\(/.test(code),
    ].filter(Boolean).length;

    if (clojureIndicators >= 1) {
      return 'clojure';
    }
  }

  return null;
};
