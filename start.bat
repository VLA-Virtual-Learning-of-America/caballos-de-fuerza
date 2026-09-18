@echo off
title Caballos de Fuerza - VLA
cd /d "%~dp0"
start "" http://localhost:4173
node server.js
pause
