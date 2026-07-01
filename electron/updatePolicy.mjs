const directUpdatePolicy = {
  distribution: 'direct',
  checkEnabled: true,
  backgroundDownloadEnabled: true,
  localInstallerEnabled: true,
  externalDownloadEnabled: true,
  cleanupDownloadedUpdatesEnabled: true,
};

const microsoftStoreUpdatePolicy = {
  distribution: 'microsoft-store',
  checkEnabled: false,
  backgroundDownloadEnabled: false,
  localInstallerEnabled: false,
  externalDownloadEnabled: false,
  cleanupDownloadedUpdatesEnabled: true,
};

function normalizeDistributionChannel(value) {
  const channel = String(value ?? '')
    .trim()
    .toLowerCase();

  if (!channel) return 'direct';
  if (channel === 'ms-store' || channel === 'microsoft' || channel === 'windows-store') {
    return 'microsoft-store';
  }
  if (channel === 'direct' || channel === 'github' || channel === 'website') {
    return 'direct';
  }
  return 'direct';
}

export function resolveDesktopUpdatePolicy(env = process.env) {
  const distribution = normalizeDistributionChannel(env.APP_DISTRIBUTION_CHANNEL);
  if (distribution === 'microsoft-store') {
    return { ...microsoftStoreUpdatePolicy };
  }
  return { ...directUpdatePolicy };
}
