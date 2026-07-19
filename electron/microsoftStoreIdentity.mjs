export const MICROSOFT_STORE_PACKAGE_FAMILY_NAME = 'vladelaina.vlaina_hnew8t3b8e0t6';
export const MICROSOFT_STORE_APPLICATION_ID = 'vlaina';

export function isMicrosoftStoreRuntime(runtime = process) {
  return runtime?.windowsStore === true;
}

export function getWindowsAppUserModelId(runtime = process) {
  if (isMicrosoftStoreRuntime(runtime)) {
    return `${MICROSOFT_STORE_PACKAGE_FAMILY_NAME}!${MICROSOFT_STORE_APPLICATION_ID}`;
  }
  return 'com.vlaina.desktop';
}
