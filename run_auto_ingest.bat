@echo off
title Manhwa Generator - Auto Ingest Watcher (Google Flow + Meta AI)
cd /d "C:\Users\Administrator\Documents\MANHWA GENERATOR"
echo ================================================================
echo Manhwa Generator - Auto Ingest Watcher
echo Monitoring Downloads folder for Google Flow + Meta AI clips...
echo ================================================================
"C:\Users\Administrator\AppData\Local\Programs\Python\Python311\python.exe" backend\auto_ingest_worker.py --watch
pause
