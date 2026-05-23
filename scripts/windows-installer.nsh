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
