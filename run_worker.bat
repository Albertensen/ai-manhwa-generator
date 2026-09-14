@echo off
title Manhwa Generator - Local RTX Worker
cd /d "C:\Users\Administrator\Documents\MANHWA GENERATOR\backend"
echo ===================================================
echo Starting Manhwa Generator Local GPU Worker
echo ComfyUI SDXL + Edge-TTS + FFmpeg Ken Burns
echo ===================================================
"C:\ComfyUI\.venv\Scripts\python.exe" worker.py
pause
