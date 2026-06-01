import { themeColorTokens } from '@/styles/themeTokens';

export function createDefaultMermaidThemeConfig() {
  return {
    theme: 'base',
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
    },
  };
}
