!include WordFunc.nsh

!macro parseSemverForCompare INPUT OUT_BASE OUT_HAS_PRERELEASE TEMP_INDEX TEMP_CHAR
  StrCpy ${OUT_BASE} "${INPUT}"
  StrCpy ${OUT_HAS_PRERELEASE} "0"
  StrCpy ${TEMP_INDEX} 0

  ${Do}
    StrCpy ${TEMP_CHAR} ${OUT_BASE} 1 ${TEMP_INDEX}
    ${If} ${TEMP_CHAR} == ""
      ${Break}
    ${EndIf}
    ${If} ${TEMP_CHAR} == "-"
      StrCpy ${OUT_HAS_PRERELEASE} "1"
      StrCpy ${OUT_BASE} ${OUT_BASE} ${TEMP_INDEX}
      ${Break}
    ${EndIf}
    ${If} ${TEMP_CHAR} == "+"
      StrCpy ${OUT_BASE} ${OUT_BASE} ${TEMP_INDEX}
      ${Break}
    ${EndIf}
    IntOp ${TEMP_INDEX} ${TEMP_INDEX} + 1
  ${Loop}
!macroend

!macro abortIfInstalledVersionIsNewer ROOT_KEY
  ReadRegStr $R2 ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${if} $R2 == ""
    !ifdef UNINSTALL_REGISTRY_KEY_2
      ReadRegStr $R2 ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY_2}" "DisplayVersion"
    !endif
  ${endif}

  ${if} $R2 != ""
    !insertmacro parseSemverForCompare "$R2" $R4 $R5 $R8 $R9
    !insertmacro parseSemverForCompare "${VERSION}" $R6 $R7 $R8 $R9
    ${VersionCompare} "$R4" "$R6" $R3

    ${if} $R3 == "1"
    ${orIf} $R3 == "0"
    ${andIf} $R5 == "0"
    ${andIf} $R7 == "1"
      ${ifNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "A newer version of ${PRODUCT_NAME} ($R2) is already installed. This installer contains ${VERSION}."
      ${endif}
      SetErrorLevel 1
      Quit
    ${endif}
  ${endif}
!macroend

!macro customInit
  !insertmacro abortIfInstalledVersionIsNewer HKCU
  !insertmacro abortIfInstalledVersionIsNewer HKLM

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
