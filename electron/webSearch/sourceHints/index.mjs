import { buildCommonOfficialSourceHints } from './commonOfficialSourceHints.mjs';
import { buildEverydayOfficialSourceHints } from './everydayOfficialSourceHints.mjs';
import { buildExpandedOfficialSourceHints } from './expandedOfficialSourceHints.mjs';
import { buildGeneralOfficialSourceHints } from './generalOfficialSourceHints.mjs';
import { buildHighRiskSourceHints } from './highRiskSourceHints.mjs';
import { buildOfficialSourceHints } from './officialSourceHints.mjs';
import { buildPackageRegistrySourceHints } from './packageRegistrySourceHints.mjs';

export { buildCommonOfficialSourceHints } from './commonOfficialSourceHints.mjs';
export { buildEverydayOfficialSourceHints } from './everydayOfficialSourceHints.mjs';
export { buildExpandedOfficialSourceHints } from './expandedOfficialSourceHints.mjs';
export { buildGeneralOfficialSourceHints } from './generalOfficialSourceHints.mjs';
export { buildHighRiskSourceHints } from './highRiskSourceHints.mjs';
export { buildOfficialSourceHints } from './officialSourceHints.mjs';
export { buildPackageRegistrySourceHints } from './packageRegistrySourceHints.mjs';

export function buildAllSourceHints(query) {
  return [
    ...buildHighRiskSourceHints(query),
    ...buildPackageRegistrySourceHints(query),
    ...buildEverydayOfficialSourceHints(query),
    ...buildGeneralOfficialSourceHints(query),
    ...buildCommonOfficialSourceHints(query),
    ...buildExpandedOfficialSourceHints(query),
    ...buildOfficialSourceHints(query),
  ];
}
