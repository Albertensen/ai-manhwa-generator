@echo off
title Manhwa Generator - Auto Ingest Watcher (Isolated Mode)
cd /d "C:\Users\Administrator\Documents\MANHWA GENERATOR"
echo ================================================================
echo Manhwa Generator - Auto Ingest Watcher
echo Monitoring Isolated Drop Folders for Google Flow + Meta AI Clips...
echo ================================================================
"C:\Users\Administrator\AppData\Local\Programs\Python\Python311\python.exe" -u backend\auto_ingest_worker.py --watch --clean-start
pause
