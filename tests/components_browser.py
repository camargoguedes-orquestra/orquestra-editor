"""Browser checks for independent components, using the same local server as tests/smoke.py."""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8765"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1200, "height": 800})
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(BASE + "/examples/file-viewer-demo.html")
    page.locator("#abrir").click()
    page.locator(".orq-viewer-text").wait_for(timeout=10000)
    assert "Componente FileViewer independente." in page.locator(".orq-viewer-text").inner_text()
    page.goto(BASE + "/examples/javascript/upload.html")
    page.locator(".orq-file-uploader").wait_for(timeout=10000)
    page.locator(".orq-input").set_input_files({
        "name": "contrato.pdf", "mimeType": "application/pdf",
        "buffer": b"%PDF-1.4\n%demo\n"
    })
    assert page.locator(".orq-file").count() == 1
    page.goto(BASE + "/examples/image-uploader.html")
    page.locator(".oi-uploader").wait_for(timeout=10000)
    assert not errors, errors
    browser.close()
print("Standalone browser smoke: OK")
