@echo off
rem Lance GuitareCourse : demarre le serveur local et ouvre le navigateur.
rem   - Double-clic pour lancer. La fenetre se reduit dans la barre des taches.
rem   - Fermer cette fenetre arrete le serveur.
rem   - Si GuitareCourse tourne deja, ce fichier ouvre seulement le navigateur.
rem
rem Options (variables d'environnement) : GUITARECOURSE_PORT (defaut 5174), GUITARECOURSE_NO_BROWSER=1.
setlocal
cd /d "%~dp0"

if not defined GUITARECOURSE_PORT set GUITARECOURSE_PORT=5174

rem Premiere passe : on se relance dans une fenetre reduite, puis cette fenetre se ferme.
if /i not "%~1"=="run" (
  start "GuitareCourse" /min cmd /c ""%~f0" run"
  exit /b
)

title GuitareCourse - fermez cette fenetre pour arreter

rem Deja lance (par ce fichier ou par "npm run dev") : on ouvre seulement le navigateur.
netstat -ano | findstr /R /C:":%GUITARECOURSE_PORT% .*LISTENING" >nul
if not errorlevel 1 (
  if not defined GUITARECOURSE_NO_BROWSER start "" "http://localhost:%GUITARECOURSE_PORT%"
  exit /b
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Les dependances ne sont pas installees.
  echo Ouvrez un terminal dans ce dossier et lancez : npm.cmd install
  pause
  exit /b 1
)

set OPEN=--open
if defined GUITARECOURSE_NO_BROWSER set OPEN=

call npm.cmd run dev -- --port %GUITARECOURSE_PORT% --strictPort %OPEN%

echo.
echo Le serveur s'est arrete. Vous pouvez fermer cette fenetre.
pause
