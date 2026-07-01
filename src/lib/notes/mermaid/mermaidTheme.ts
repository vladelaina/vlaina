import { themeColorTokens, themeMermaidTokens } from '@/styles/themeTokens';

const MERMAID_COLOR_SCALE_LABEL_COUNT = 12;

export function createDefaultMermaidThemeConfig() {
  const scaleLabelVariables = Object.fromEntries(
    Array.from({ length: MERMAID_COLOR_SCALE_LABEL_COUNT }, (_value, index) => [
      `cScaleLabel${index}`,
      themeColorTokens.mermaidText,
    ])
  );

  return {
    theme: 'base',
    quadrantChart: {
      quadrantTextTopPadding: themeMermaidTokens.quadrantTextTopPaddingPx,
    },
    themeVariables: {
      background: themeColorTokens.mermaidSurface,
      primaryColor: themeColorTokens.mermaidSurface,
      primaryTextColor: themeColorTokens.mermaidText,
      primaryBorderColor: themeColorTokens.mermaidBorder,
      lineColor: themeColorTokens.mermaidLine,
      secondaryColor: themeColorTokens.mermaidSurfaceSecondary,
      tertiaryColor: themeColorTokens.mermaidSurfaceTertiary,
      textColor: themeColorTokens.mermaidText,
      mainBkg: themeColorTokens.mermaidSurface,
      secondBkg: themeColorTokens.mermaidSurfaceSecondary,
      nodeBorder: themeColorTokens.mermaidBorder,
      clusterBkg: themeColorTokens.mermaidSurfaceTertiary,
      clusterBorder: themeColorTokens.mermaidBorder,
      edgeLabelBackground: themeColorTokens.mermaidSurface,
      scaleLabelColor: themeColorTokens.mermaidText,
      ...scaleLabelVariables,
      quadrantPointFill: themeColorTokens.mermaidBorder,
      quadrantPointTextFill: themeColorTokens.mermaidText,
      vennSetTextColor: themeColorTokens.mermaidText,
      vennTitleTextColor: themeColorTokens.mermaidText,
    },
  };
}
