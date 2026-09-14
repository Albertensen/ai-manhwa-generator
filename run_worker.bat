@echo off
title Manhwa Generator - Local RTX Worker
cd /d "C:\Users\Administrator\Documents\MANHWA GENERATOR"
echo ===================================================
echo Starting Manhwa Generator Local GPU Worker
echo ComfyUI SDXL + IP-Adapter + Edge-TTS + FFmpeg
echo ===================================================
"C:\ComfyUI\.venv\Scripts\python.exe" backend\worker.py
pause
