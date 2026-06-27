!macro customInit
  !ifndef INSTALL_MODE_PER_ALL_USERS
    !ifndef ONE_CLICK
      !insertmacro GetDParameter $R0
      ${ifNot} ${Silent}
      ${andIfNot} ${isUpdated}
      ${andIf} $R0 == ""
        ${if} $installMode == "CurrentUser"
        ${andIf} $perUserInstallationFolder != ""
          # Re-enter through electron-builder's update path so assisted upgrades skip the directory page.
          ${GetParameters} $R1
          Exec '"$EXEPATH" --updated $R1'
          Quit
        ${elseif} $installMode == "all"
        ${andIf} $perMachineInstallationFolder != ""
          # Re-enter through electron-builder's update path so assisted upgrades skip the directory page.
          ${GetParameters} $R1
          Exec '"$EXEPATH" --updated $R1'
          Quit
        ${endif}
      ${endif}
    !endif
  !endif
!macroend

!macro customUnInstallSection
  Section /o "un.Delete local user data" SEC_UNINSTALL_USER_DATA
    # Electron stores userData in the current user's roaming AppData directory.
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}

    RMDir /r "$APPDATA\${APP_FILENAME}"
    !ifdef APP_PRODUCT_FILENAME
      RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
    !endif
    !ifdef APP_PACKAGE_NAME
      RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
    !endif

    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  SectionEnd
!macroend
