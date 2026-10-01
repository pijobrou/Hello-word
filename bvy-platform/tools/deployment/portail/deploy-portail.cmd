@echo off
setlocal EnableExtensions
rem ==========================================================================
rem  BVY - deploiement du PORTAIL (portail.bvyaccountingtax.ca) depuis Windows
rem  Utilisation :
rem     bvy-platform\tools\deployment\portail\deploy-portail.cmd              nouvelle version
rem     bvy-platform\tools\deployment\portail\deploy-portail.cmd --rollback   version precedente
rem  Outils (inclus dans Windows 10/11) : tar, ssh, scp. Aucun mot de passe n'est ecrit ici.
rem ==========================================================================

rem ---- REGLAGES ------------------------------------------------------------
set "SERVER=148.113.238.146"
set "USER=ubuntu"
set "SSH_KEY="
rem -------------------------------------------------------------------------

set "PAUSE_AT_END="
set "CCL=%CMDCMDLINE:"=%"
if /i not "%CCL:/c =%"=="%CCL%" set "PAUSE_AT_END=1"
set "RC=0"
set "KIT=%~dp0"
if "%KIT:~-1%"=="\" set "KIT=%KIT:~0,-1%"
for %%I in ("%KIT%\..\..\..") do set "PLATFORM=%%~fI"
set "APP=%PLATFORM%\apps\portal"
set "STAGE=%TEMP%\bvy-portail-deploy"
set "LIST=%TEMP%\bvy-portail-fichiers.txt"
set "TARGET=%USER%@%SERVER%"
set "SSH_OPTS=-o ConnectTimeout=15 -o ServerAliveInterval=30"
if defined SSH_KEY set "SSH_OPTS=%SSH_OPTS% -i "%SSH_KEY%""

echo.
echo ============================================================
echo   BVY - Deploiement du portail vers %SERVER%
echo ============================================================

echo.
echo [1/5] Verification des outils Windows...
where ssh >nul 2>&1 || goto :no_tools
where scp >nul 2>&1 || goto :no_tools
where tar >nul 2>&1 || goto :no_tools
echo   OK  ssh, scp et tar sont disponibles.

if /i "%~1"=="--rollback" goto :rollback

echo.
echo [2/5] Dossier du portail : %APP%
if not exist "%APP%\server.js" goto :no_app
if not exist "%APP%\public\assets\tokens.css" goto :no_app
if not exist "%KIT%\remote-install-portail.sh" goto :no_app
echo   OK  Portail trouve.

echo.
echo [3/5] Preparation de l'archive (sans data, .env, node_modules, test)...
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%" || goto :fail_pack
if exist "%LIST%" del /q "%LIST%"
for /f "delims=" %%F in ('dir /b /a "%APP%"') do (
  if /i not "%%F"=="data" if /i not "%%F"==".env" if /i not "%%F"=="node_modules" if /i not "%%F"=="test" if /i not "%%F"==".git" >>"%LIST%" echo %%F
)
pushd "%APP%"
tar -czf "%STAGE%\bvy-portail.tar.gz" -T "%LIST%"
if errorlevel 1 ( popd & goto :fail_pack )
popd
del /q "%LIST%" >nul 2>&1
copy /y "%KIT%\remote-install-portail.sh" "%STAGE%\" >nul || goto :fail_pack
xcopy /e /i /y /q "%KIT%\nginx" "%STAGE%\nginx" >nul || goto :fail_pack
xcopy /e /i /y /q "%KIT%\systemd" "%STAGE%\systemd" >nul || goto :fail_pack
echo   OK  Archive prete.

echo.
echo [4/5] Envoi vers %TARGET%:/tmp/bvy-portail/
echo       (mot de passe de "%USER%" sur le serveur ; rien ne s'affiche pendant la saisie, c'est normal)
ssh %SSH_OPTS% %TARGET% "rm -rf /tmp/bvy-portail && mkdir -p /tmp/bvy-portail"
if errorlevel 1 goto :fail_ssh
pushd "%STAGE%"
scp %SSH_OPTS% -r bvy-portail.tar.gz remote-install-portail.sh nginx systemd %TARGET%:/tmp/bvy-portail/
if errorlevel 1 ( popd & goto :fail_ssh )
popd
echo   OK  Fichiers envoyes.

echo.
echo [5/5] Installation sur le serveur...
ssh -t %SSH_OPTS% %TARGET% "sed -i 's/\r$//' /tmp/bvy-portail/remote-install-portail.sh && sudo bash /tmp/bvy-portail/remote-install-portail.sh /tmp/bvy-portail/bvy-portail.tar.gz"
if errorlevel 1 goto :fail_remote
rmdir /s /q "%STAGE%" >nul 2>&1
echo.
echo ============================================================
echo   TERMINE. Lisez les dernieres lignes ci-dessus (prochaine etape).
echo ============================================================
goto :finish

:rollback
echo.
echo Retour a la version precedente du portail...
ssh -t %SSH_OPTS% %TARGET% "sudo bash /var/www/bvy-portail/shared/deploy-kit/remote-install-portail.sh --rollback"
if errorlevel 1 goto :fail_remote
goto :finish

:no_tools
echo   ERREUR  ssh, scp ou tar introuvable. Voir DEPLOIEMENT.md, section 1.1.
set "RC=1"
goto :finish

:no_app
echo   ERREUR  Le portail est introuvable dans %APP% (ZIP entierement decompresse ?).
set "RC=1"
goto :finish

:fail_pack
echo   ERREUR  Impossible de preparer l'archive dans %STAGE%
set "RC=1"
goto :finish

:fail_ssh
echo   ERREUR  Connexion ou envoi vers %TARGET% impossible. Test :  ssh %TARGET%
set "RC=1"
goto :finish

:fail_remote
echo.
echo   ERREUR  L'installation sur le serveur a signale un probleme (voir les lignes en rouge).
echo   Le site public n'est pas touche ; l'ancienne version du portail reste en place si elle existait.
set "RC=1"
goto :finish

:finish
if defined PAUSE_AT_END ( echo. & pause )
exit /b %RC%
