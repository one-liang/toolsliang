from __future__ import annotations

import math
import re
from pathlib import Path

from playwright.sync_api import ConsoleMessage, Page, sync_playwright


ORIGIN = "http://127.0.0.1:3000"
BASE_URL = f"{ORIGIN}/zh-tw"
SCREENSHOT_DIR = Path("docs/prototypes/screenshots")
VIEWPORTS = {
    "mobile": {"width": 375, "height": 812},
    "tablet": {"width": 768, "height": 1024},
    "desktop": {"width": 1440, "height": 1000},
}


def parse_rgb(value: str) -> tuple[int, int, int]:
    if value.startswith("#"):
        value = value.removeprefix("#")
        return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))
    match = re.search(r"rgba?\((\d+),?\s+(\d+),?\s+(\d+)", value)
    if not match:
        raise ValueError(f"Unsupported color: {value}")
    return tuple(int(channel) for channel in match.groups())


def luminance(color: str) -> float:
    channels = []
    for channel in parse_rgb(color):
        normalized = channel / 255
        channels.append(normalized / 12.92 if normalized <= 0.04045 else math.pow((normalized + 0.055) / 1.055, 2.4))
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast(first: str, second: str) -> float:
    bright, dark = sorted((luminance(first), luminance(second)), reverse=True)
    return (bright + 0.05) / (dark + 0.05)


def collect_errors(page: Page, errors: list[str]) -> None:
    def on_console(message: ConsoleMessage) -> None:
        if message.type == "error":
            errors.append(f"console: {message.text}")

    page.on("console", on_console)
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))


def main() -> None:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    external_requests: set[str] = set()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)

        for variant in ("A", "B", "C"):
            for viewport_name, viewport in VIEWPORTS.items():
                page = browser.new_page(viewport=viewport)
                collect_errors(page, console_errors)
                page.on(
                    "request",
                    lambda request: external_requests.add(request.url)
                    if not request.url.startswith((ORIGIN, "data:", "blob:"))
                    else None,
                )
                page.goto(f"{BASE_URL}/?variant={variant}", wait_until="networkidle")
                if variant == "B":
                    page.locator('.variant-b[data-motion="ready"]').wait_for(state="visible")
                assert page.locator("h1").is_visible(), f"Variant {variant} has no visible h1 at {viewport_name}"
                assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), (
                    f"Variant {variant} overflows horizontally at {viewport_name}"
                )
                if viewport_name == "mobile":
                    assert page.locator(".mobile-navigation").is_visible(), f"Mobile nav missing in Variant {variant}"
                if viewport_name == "desktop":
                    assert not page.locator(".mobile-navigation").is_visible(), f"Mobile nav visible on desktop in Variant {variant}"
                    page.screenshot(path=SCREENSHOT_DIR / f"variant-{variant.lower()}-desktop.png", full_page=True)
                if viewport_name == "mobile":
                    page.screenshot(path=SCREENSHOT_DIR / f"variant-{variant.lower()}-mobile.png", full_page=False)
                page.close()

        page = browser.new_page(viewport=VIEWPORTS["desktop"])
        collect_errors(page, console_errors)
        page.goto(f"{BASE_URL}/?variant=A", wait_until="networkidle")

        page.locator("h1").click()
        page.keyboard.press("ArrowRight")
        page.wait_for_url(re.compile(r"variant=B"))
        page.locator("input[type=search]").first.focus()
        page.keyboard.press("ArrowRight")
        assert "variant=B" in page.url, "Arrow key changed variant while search input was focused"

        page.goto(f"{BASE_URL}/?variant=A", wait_until="networkidle")
        sidebar = page.locator(".workspace-stage .app-sidebar")
        before_width = sidebar.bounding_box()["width"]
        sidebar.locator("button[aria-expanded]").click()
        page.wait_for_timeout(250)
        after_width = sidebar.bounding_box()["width"]
        assert after_width < before_width, "Desktop sidebar did not collapse"

        page.locator(".utility-controls .icon-button").first.click()
        assert page.locator(".prototype-root.is-dark").count() == 1, "Dark theme did not activate"
        page.wait_for_timeout(250)
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=SCREENSHOT_DIR / "variant-a-dark-desktop.png", full_page=False)
        page.locator(".utility-controls .text-button").first.click()
        page.wait_for_url(re.compile(r"/en/.*variant=A"))
        page.wait_for_function("document.documentElement.lang === 'en'")
        assert page.locator("html").get_attribute("lang") == "en", "English locale indicator did not activate"

        amount = page.locator("#amount")
        amount.fill("12850.5")
        assert "壹萬貳仟捌佰伍拾" in page.locator(".result-panel output").inner_text(), "Local amount conversion failed"

        tokens = page.evaluate(
            """
            () => {
              const style = getComputedStyle(document.documentElement)
              return {
                ink: style.getPropertyValue('--ink').trim(),
                muted: style.getPropertyValue('--ink-soft').trim(),
                background: style.getPropertyValue('--bg').trim(),
              }
            }
            """
        )
        assert contrast(tokens["ink"], tokens["background"]) >= 4.5, "Primary text contrast is below 4.5:1"
        assert contrast(tokens["muted"], tokens["background"]) >= 4.5, "Muted text contrast is below 4.5:1"

        page.goto(f"{BASE_URL}/?variant=B", wait_until="networkidle")
        page.locator('.variant-b[data-motion="ready"]').wait_for(state="visible")
        page.get_by_role("button", name="收起工作區").click()
        assert not page.locator(".b-workbench").is_visible(), "Variant B workspace did not close"
        page.get_by_role("button", name="打開工作頁").click()
        assert page.locator(".b-workbench").is_visible(), "Variant B workspace did not reopen"
        page.locator(".utility-controls .icon-button").first.click()
        page.wait_for_timeout(250)
        variant_b_tokens = page.locator(".variant-b").evaluate(
            """
            element => {
              const style = getComputedStyle(element)
              return {
                ink: style.getPropertyValue('--b-ink').trim(),
                muted: style.getPropertyValue('--b-muted').trim(),
                background: style.getPropertyValue('--b-bg').trim(),
              }
            }
            """
        )
        assert contrast(variant_b_tokens["ink"], variant_b_tokens["background"]) >= 4.5, "Variant B ink contrast is below 4.5:1"
        assert contrast(variant_b_tokens["muted"], variant_b_tokens["background"]) >= 4.5, "Variant B muted contrast is below 4.5:1"
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=SCREENSHOT_DIR / "variant-b-dark-desktop.png", full_page=False)
        page.close()

        reduced_page = browser.new_page(viewport=VIEWPORTS["desktop"], reduced_motion="reduce")
        collect_errors(reduced_page, console_errors)
        reduced_page.goto(f"{BASE_URL}/?variant=A", wait_until="networkidle")
        duration = reduced_page.locator(".tool-card").first.evaluate("element => getComputedStyle(element).transitionDuration")
        assert duration in ("0s", "0.00001s", "1e-05s"), f"Reduced motion rule not applied: {duration}"
        reduced_page.goto(f"{BASE_URL}/?variant=B", wait_until="networkidle")
        reduced_page.locator('.variant-b[data-motion="reduced"]').wait_for(state="visible")
        reduced_page.close()

        browser.close()

    assert not console_errors, "Browser console errors:\n" + "\n".join(console_errors)
    assert not external_requests, "External requests detected:\n" + "\n".join(sorted(external_requests))
    print("PASS: A/B/C × mobile/tablet/desktop responsive checks")
    print("PASS: keyboard switcher and input arrow-key isolation")
    print("PASS: sidebar collapse, theme, locale, and local tool interaction")
    print("PASS: reduced motion and basic WCAG contrast")
    print("PASS: no browser console errors and no external requests")


if __name__ == "__main__":
    main()
