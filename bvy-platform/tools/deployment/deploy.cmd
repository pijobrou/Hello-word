@echo off
setlocal EnableExtensions
chcp 65001 >nul
rem ==========================================================================
rem  BVY Accounting and Tax - deploiement du site public (Windows)
rem
rem  Utilisation (depuis le dossier du projet, ou n'importe ou) :
rem     bvy-platform\tools\deployment\deploy.cmd             nouvelle version
rem     bvy-platform\tools\deployment\deploy.cmd --nginx     + reinstaller nginx
rem     bvy-platform\tools\deployment\deploy.cmd --rollback  version precedente
rem
rem  Outils utilises (deja inclus dans Windows 10/11) : tar, ssh, scp.
rem  Aucun mot de passe n'est ecrit dans ce fichier : ssh vous le demandera.
rem ==========================================================================

rem ---- REGLAGES (a modifier si besoin) ------------------------------------
set "SERVER=148.113.238.146"
set "USER=ubuntu"
rem Chemin d'une cle SSH privee. Laisser vide = cle par defaut ou mot de passe.
rem Exemple : set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
set "SSH_KEY="
rem -------------------------------------------------------------------------

set "KIT=%~dp0"
if "%KIT:~-1%"=="\" set "KIT=%KIT:~0,-1%"
for %%I in ("%KIT%\..\..") do set "PLATFORM=%%~fI"
set "APP=%PLATFORM%\apps\website"
set "STAGE=%TEMP%\bvy-deploy"
set "LIST=%TEMP%\bvy-deploy-fichiers.txt"
set "TARGET=%USER%@%SERVER%"
set "SSH_OPTS=-o ConnectTimeout=15 -o ServerAliveInterval=30"
if defined SSH_KEY set "SSH_OPTS=%SSH_OPTS% -i "%SSH_KEY%""

echo.
echo ============================================================
echo   BVY - Deploiement du site public vers %SERVER%
echo ============================================================

rem ---- 1. Outils necessaires -----------------------------------------------
echo.
echo [1/6] Verification des outils Windows...
where ssh >nul 2>&1 || goto :no_openssh
where scp >nul 2>&1 || goto :no_openssh
where tar >nul 2>&1 || goto :no_tar
echo   OK  ssh, scp et tar sont disponibles.

rem ---- Cas particulier : retour a la version precedente ---------------------
if /i "%~1"=="--rollback" goto :rollback

rem ---- 2. Dossier du site ----------------------------------------------------
echo.
echo [2/6] Dossier du site : %APP%
if not exist "%APP%\server.js" goto :no_app
if not exist "%APP%\public\index.html" goto :no_app
if not exist "%KIT%\remote-install.sh" goto :no_kit
echo   OK  server.js et public\ trouves.

rem ---- 3. Generation des pages (facultatif) ---------------------------------
echo.
echo [3/6] Generation des pages (facultatif)...
set "BUILD="
if exist "%APP%\build.js" set "BUILD=%APP%\build.js"
if not defined BUILD if exist "%PLATFORM%\tools\website\build.js" set "BUILD=%PLATFORM%\tools\website\build.js"
where node >nul 2>&1
if errorlevel 1 (
  echo   --  Node.js n'est pas installe sur ce PC : on envoie public\ tel quel.
  goto :pack
)
if not defined BUILD (
  echo   --  Aucun build.js trouve : on envoie public\ tel quel.
  goto :pack
)
pushd "%APP%"
node "%BUILD%"
if errorlevel 1 (
  popd
  echo   ERREUR  La generation des pages a echoue. Rien n'a ete envoye.
  exit /b 1
)
popd
echo   OK  Pages regenerees.

rem ---- 4. Archive ----------------------------------------------------------
:pack
echo.
echo [4/6] Preparation de l'archive (sans data, .env, node_modules, test, src)...
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%" || goto :fail_pack
if exist "%LIST%" del /q "%LIST%"
for /f "delims=" %%F in ('dir /b /a "%APP%"') do (
  if /i not "%%F"=="data" if /i not "%%F"==".env" if /i not "%%F"=="node_modules" if /i not "%%F"=="test" if /i not "%%F"=="src" if /i not "%%F"==".git" >>"%LIST%" echo %%F
)
pushd "%APP%"
tar -czf "%STAGE%\bvy-website.tar.gz" -T "%LIST%"
if errorlevel 1 (
  popd
  goto :fail_pack
)
popd
del /q "%LIST%" >nul 2>&1
copy /y "%KIT%\remote-install.sh" "%STAGE%\" >nul || goto :fail_pack
xcopy /e /i /y /q "%KIT%\nginx" "%STAGE%\nginx" >nul || goto :fail_pack
xcopy /e /i /y /q "%KIT%\systemd" "%STAGE%\systemd" >nul || goto :fail_pack
echo   OK  Archive prete : %STAGE%\bvy-website.tar.gz

rem ---- 5. Envoi --------------------------------------------------------------
echo.
echo [5/6] Envoi vers %TARGET%:/tmp/bvy-deploy/
echo       (si on vous demande un mot de passe, c'est celui de "%USER%" sur le serveur ;
echo        rien ne s'affiche pendant la saisie, c'est normal)
ssh %SSH_OPTS% %TARGET% "rm -rf /tmp/bvy-deploy && mkdir -p /tmp/bvy-deploy"
if errorlevel 1 goto :fail_ssh
pushd "%STAGE%"
scp %SSH_OPTS% -r bvy-website.tar.gz remote-install.sh nginx systemd %TARGET%:/tmp/bvy-deploy/
if errorlevel 1 (
  popd
  goto :fail_ssh
)
popd
echo   OK  Fichiers envoyes.

rem ---- 6. Installation sur le serveur ---------------------------------------
echo.
echo [6/6] Installation sur le serveur...
ssh -t %SSH_OPTS% %TARGET% "sed -i 's/\r$//' /tmp/bvy-deploy/remote-install.sh && sudo bash /tmp/bvy-deploy/remote-install.sh /tmp/bvy-deploy/bvy-website.tar.gz %*"
if errorlevel 1 goto :fail_remote
rmdir /s /q "%STAGE%" >nul 2>&1
echo.
echo ============================================================
echo   TERMINE. Ouvrez https://bvyaccountingtax.ca/
echo   (Ctrl+F5 dans le navigateur pour voir la nouvelle version)
echo ============================================================
exit /b 0

rem ==========================================================================
:rollback
echo.
echo Retour a la version precedente du site sur le serveur...
ssh -t %SSH_OPTS% %TARGET% "sudo bash /var/www/bvy-website/shared/deploy-kit/remote-install.sh --rollback"
if errorlevel 1 goto :fail_remote
echo   OK  Version precedente remise en ligne.
exit /b 0

rem ==========================================================================
:no_openssh
echo.
echo   ERREUR  ssh ou scp introuvable : le "Client OpenSSH" de Windows n'est pas installe.
echo   Pour l'installer :
echo     1. Menu Demarrer ^> Parametres ^> Applications ^> Fonctionnalites facultatives
echo     2. "Ajouter une fonctionnalite" ^> cocher "Client OpenSSH" ^> Installer
echo     3. Fermer puis rouvrir cette fenetre, et taper :  ssh -V
echo   (ou, dans PowerShell en administrateur :
echo    Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 )
exit /b 1

:no_tar
echo.
echo   ERREUR  La commande tar est introuvable (Windows 10 version 1803 ou plus recent requis).
echo   Mettez Windows a jour, ou utilisez la methode manuelle du guide DEPLOIEMENT.md.
exit /b 1

:no_app
echo.
echo   ERREUR  Le site est introuvable dans :
echo           %APP%
echo   Il faut server.js et public\index.html. Verifiez que le projet est complet
echo   (bonne branche git, ou ZIP entierement decompresse).
exit /b 1

:no_kit
echo.
echo   ERREUR  remote-install.sh est introuvable dans %KIT%
exit /b 1

:fail_pack
echo.
echo   ERREUR  Impossible de preparer l'archive dans %STAGE%
exit /b 1

:fail_ssh
echo.
echo   ERREUR  Connexion ou envoi vers %TARGET% impossible.
echo   Verifiez : Internet, l'adresse %SERVER%, le mot de passe ou la cle SSH.
echo   Test simple :  ssh %TARGET%
exit /b 1

:fail_remote
echo.
echo   ERREUR  L'installation sur le serveur a signale un probleme (voir les lignes en rouge).
echo   Le site precedent reste en ligne si la nouvelle version ne demarrait pas.
echo   Voir le guide DEPLOIEMENT.md, section 11 (Depannage).
exit /b 1
