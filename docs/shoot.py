#!/usr/bin/env python3
"""Capture the README images from the generated docs pages.

Run docs/build.py and docs/build_fonts.py first, and docs/cockpit.ts (see its
header) for the cockpit, then:

    python3 docs/shoot.py

Writes assets/presets/<id>.png for #hero, the 15 preset cards and #plans of
docs/index.html, assets/presets/cockpit.png from docs/cockpit.html, and
assets/fonts-demo.png from docs/fonts.html, at 2x.
Needs Python Playwright with Chromium (pip install playwright && playwright install chromium).
"""
import asyncio
import pathlib

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIZES = ["xsmall", "small", "medium", "large", "xlarge"]
PRESETS = [size + suffix for size in SIZES for suffix in ("", "-plain", "-simple")]
IDS = ["hero", *PRESETS, "plans"]


async def open_page(browser, html: str, width: int):
    page = await browser.new_page(viewport={"width": width, "height": 900}, device_scale_factor=2)
    await page.goto((ROOT / "docs" / html).as_uri(), wait_until="networkidle")
    await page.evaluate("document.fonts.ready")
    # One viewport as tall as the page: element shots then need no scrolling,
    # which can leave a light seam at a card's edge.
    height = await page.evaluate("document.documentElement.scrollHeight")
    await page.set_viewport_size({"width": width, "height": height})
    await page.wait_for_timeout(600)
    return page


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        page = await open_page(browser, "index.html", 1048)
        for element_id in IDS:
            element = await page.query_selector(f'[id="{element_id}"]')
            assert element is not None, element_id
            await element.screenshot(path=str(ROOT / "assets" / "presets" / f"{element_id}.png"))
            print("saved", f"assets/presets/{element_id}.png")
        await page.close()

        page = await open_page(browser, "cockpit.html", 900)
        element = await page.query_selector("#cockpit")
        assert element is not None
        await element.screenshot(path=str(ROOT / "assets" / "presets" / "cockpit.png"))
        print("saved assets/presets/cockpit.png")
        await page.close()

        page = await open_page(browser, "fonts.html", 1140)
        await page.screenshot(path=str(ROOT / "assets" / "fonts-demo.png"), full_page=True)
        print("saved assets/fonts-demo.png")
        await browser.close()


asyncio.run(main())
