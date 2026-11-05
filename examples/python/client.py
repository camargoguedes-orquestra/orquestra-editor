"""Cliente Python stdlib para API REST do sistema hospedeiro.
Uso: ORQ_API_URL=https://seu-servidor.example ORQ_API_TOKEN=... python client.py
A API de documentos e um contrato; o host precisa implementa-la.
"""
import json
import os
from urllib.request import Request, urlopen

def list_documents(base_url: str, token: str) -> list:
    if not base_url.startswith("https://"):
        raise ValueError("Em producao, use HTTPS")
    url = base_url.rstrip("/") + "/api/documents"
    req = Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    with urlopen(req, timeout=15) as response:
        result = json.load(response)
    if not isinstance(result, list):
        raise ValueError("API deveria retornar lista")
    return result

if __name__ == "__main__":
    base = os.environ.get("ORQ_API_URL", "")
    token = os.environ.get("ORQ_API_TOKEN", "")
    if not base or not token:
        raise SystemExit("Defina ORQ_API_URL e ORQ_API_TOKEN")
    print(json.dumps(list_documents(base, token), indent=2, ensure_ascii=False))
