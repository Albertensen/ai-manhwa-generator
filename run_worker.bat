@echo off
title Manhwa Generator - Production AI Worker
cd /d "C:\Users\Administrator\Documents\MANHWA GENERATOR"
echo ===================================================
echo Starting Manhwa Generator AI Worker
echo 9Router Gemini + Playwright Motion + Edge-TTS + FFmpeg
echo ===================================================
"C:\Users\Administrator\AppData\Local\Programs\Python\Python311\python.exe" backend\worker.py
pause
