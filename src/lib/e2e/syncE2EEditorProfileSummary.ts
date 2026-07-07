import type { EditorDispatchProfileSummary } from './syncE2EBridgeTypes';
import type { ActiveEditorDispatchProfile } from './syncE2EEditorProfileTypes';

export function getTransactionInsertedTextLength(tr: unknown): number {
  const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
  let length = 0;

  for (const step of steps) {
    const content = (step as {
      slice?: {
        content?: {
          size?: number;
          textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
        };
      };
    }).slice?.content;
    if (!content || typeof content.size !== 'number') {
      continue;
    }
    if (typeof content.textBetween === 'function') {
      length += content.textBetween(0, content.size, '\n', '\ufffc').length;
    } else {
      length += content.size;
    }
  }

  return length;
}

export function buildEditorDispatchProfileSummary(
  profile: ActiveEditorDispatchProfile,
): EditorDispatchProfileSummary {
  const samples = profile.samples;
  const sortedDurations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const pick = (ratio: number) =>
    sortedDurations[Math.min(sortedDurations.length - 1, Math.max(0, Math.ceil(sortedDurations.length * ratio) - 1))] ?? 0;
  const round = (value: number) => Math.round(value * 10) / 10;
  const summarizeSamples = (values: number[]) => {
    const sortedValues = [...values].sort((a, b) => a - b);
    const pickValue = (ratio: number) =>
      sortedValues[Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1))] ?? 0;
    return {
      count: values.length,
      maxMs: round(Math.max(0, ...values)),
      p95Ms: round(pickValue(0.95)),
      totalMs: round(values.reduce((sum, value) => sum + value, 0)),
    };
  };
  const pluginApplySummaries = Array.from(profile.pluginSamples.entries()).map(([key, pluginSamples]) => {
    const sortedPluginSamples = [...pluginSamples].sort((a, b) => a - b);
    const pickPlugin = (ratio: number) =>
      sortedPluginSamples[Math.min(sortedPluginSamples.length - 1, Math.max(0, Math.ceil(sortedPluginSamples.length * ratio) - 1))] ?? 0;
    return {
      count: pluginSamples.length,
      key,
      maxMs: round(Math.max(0, ...pluginSamples)),
      p95Ms: round(pickPlugin(0.95)),
      totalMs: round(pluginSamples.reduce((sum, value) => sum + value, 0)),
    };
  });
  const decorationPropSummaries = Array.from(profile.decorationSamples.entries()).map(([key, decorationSamples]) => {
    const sortedDecorationSamples = [...decorationSamples].sort((a, b) => a - b);
    const pickDecoration = (ratio: number) =>
      sortedDecorationSamples[Math.min(sortedDecorationSamples.length - 1, Math.max(0, Math.ceil(sortedDecorationSamples.length * ratio) - 1))] ?? 0;
    return {
      count: decorationSamples.length,
      key,
      maxMs: round(Math.max(0, ...decorationSamples)),
      p95Ms: round(pickDecoration(0.95)),
      totalMs: round(decorationSamples.reduce((sum, value) => sum + value, 0)),
    };
  });
  const updateStateSummary = summarizeSamples(profile.updateStateSamples);
  const updateStateInnerSummary = summarizeSamples(profile.updateStateInnerSamples);

  return {
    decorationPropTotalMs: round(decorationPropSummaries.reduce((sum, summary) => sum + summary.totalMs, 0)),
    dispatchCount: samples.length,
    docChangedCount: samples.filter((sample) => sample.docChanged).length,
    insertedTextLength: samples.reduce((sum, sample) => sum + sample.insertedTextLength, 0),
    maxDispatchMs: round(Math.max(0, ...samples.map((sample) => sample.durationMs))),
    pluginApplyTotalMs: round(pluginApplySummaries.reduce((sum, summary) => sum + summary.totalMs, 0)),
    p95DispatchMs: round(pick(0.95)),
    totalDispatchMs: round(samples.reduce((sum, sample) => sum + sample.durationMs, 0)),
    totalProfileMs: round(performance.now() - profile.startedAt),
    totalStepCount: samples.reduce((sum, sample) => sum + sample.stepCount, 0),
    updateStateCount: updateStateSummary.count,
    updateStateMaxMs: updateStateSummary.maxMs,
    updateStateP95Ms: updateStateSummary.p95Ms,
    updateStateTotalMs: updateStateSummary.totalMs,
    updateStateInnerCount: updateStateInnerSummary.count,
    updateStateInnerMaxMs: updateStateInnerSummary.maxMs,
    updateStateInnerP95Ms: updateStateInnerSummary.p95Ms,
    updateStateInnerTotalMs: updateStateInnerSummary.totalMs,
    slowestPluginApplies: pluginApplySummaries
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 12),
    slowestDispatches: [...samples]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 8)
      .map((sample) => ({
        docChanged: sample.docChanged,
        durationMs: round(sample.durationMs),
        insertedTextLength: sample.insertedTextLength,
        selectionSet: sample.selectionSet,
        stepCount: sample.stepCount,
      })),
    slowestDecorationProps: decorationPropSummaries
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, 12),
  };
}
