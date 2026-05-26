import { describe, expect, it } from "vitest";

import { buildRequestUsageDisplayModel } from "../admin/src/users/presentation.js";

const NOW_MS = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildUser(overrides = {}) {
  return {
    requestCount: 10,
    billedPoints: 100,
    membershipStatus: "active",
    points: {
      totalRemainingPoints: 200,
      usedPoints: 0,
      nextResetAtMs: NOW_MS + 10 * DAY_MS,
    },
    ...overrides,
  };
}

describe("admin user request usage display", () => {
  it("uses billed points when audit billing totals are available", () => {
    expect(buildRequestUsageDisplayModel(buildUser(), NOW_MS)).toEqual({
      empty: false,
      main: "10/30（2）",
      sub: "10 分/次",
    });
  });

  it("falls back to cycle balance consumption when billed points are missing", () => {
    expect(
      buildRequestUsageDisplayModel(
        buildUser({
          billedPoints: 0,
          points: {
            totalRemainingPoints: 200,
            usedPoints: 50,
            nextResetAtMs: NOW_MS + 10 * DAY_MS,
          },
        }),
        NOW_MS
      )
    ).toEqual({
      empty: false,
      main: "10/50（4）",
      sub: "约 5 分/次",
    });
  });

  it("keeps request count visible when no cost basis exists", () => {
    expect(
      buildRequestUsageDisplayModel(
        buildUser({
          billedPoints: 0,
          requestCount: 3,
          points: {
            totalRemainingPoints: 200,
            usedPoints: 0,
            nextResetAtMs: NOW_MS + 10 * DAY_MS,
          },
        }),
        NOW_MS
      )
    ).toEqual({
      empty: true,
      main: "3/--（--）",
      sub: "暂无扣费均值",
    });
  });
});
