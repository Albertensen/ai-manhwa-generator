import urllib.request
import json
import mimetypes
from pathlib import Path
try:
    from . import config
except (ImportError, ValueError):
    import config

def upload_file(local_path, remote_path):
    """Uploads local file to Supabase storage bucket 'manhwa-assets' and returns public URL"""
    mime_type, _ = mimetypes.guess_type(str(local_path))
    if not mime_type:
        mime_type = "application/octet-stream"
    
    with open(local_path, "rb") as f:
        file_bytes = f.read()

    url = f"{config.SUPABASE_URL}/storage/v1/object/manhwa-assets/{remote_path}"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": mime_type,
        "x-upsert": "true"
    }

    req = urllib.request.Request(url, data=file_bytes, headers=headers, method="POST")
    with urllib.request.urlopen(req) as res:
        res_data = json.loads(res.read())
        public_url = f"{config.SUPABASE_URL}/storage/v1/object/public/manhwa-assets/{remote_path}"
        return public_url
