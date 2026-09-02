from __future__ import annotations

import json
import math
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000"
ARTIFACTS = Path("artifacts/ui-validation")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def assert_no_overflow(page, label: str) -> None:
    dimensions = page.evaluate("""() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    })""")
    assert dimensions["scroll"] <= dimensions["client"] + 1, f"{label}: horizontal overflow {dimensions}"


def rgb(value: str) -> tuple[float, float, float]:
    channels = re.findall(r"[\d.]+", value)[:3]
    assert len(channels) == 3, f"Unsupported color: {value}"
    return tuple(float(channel) / 255 for channel in channels)


def luminance(value: str) -> float:
    linear = []
    for channel in rgb(value):
        linear.append(channel / 12.92 if channel <= 0.04045 else math.pow((channel + 0.055) / 1.055, 2.4))
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(foreground: str, background: str) -> float:
    lighter, darker = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def assert_contrast(page, selector: str, minimum: float = 4.5) -> None:
    colors = page.locator(selector).first.evaluate("""element => {
      const style = getComputedStyle(element)
      let parent = element
      let background = style.backgroundColor
      while (background === 'rgba(0, 0, 0, 0)' && parent.parentElement) {
        parent = parent.parentElement
        background = getComputedStyle(parent).backgroundColor
      }
      return { foreground: style.color, background }
    }""")
    ratio = contrast(colors["foreground"], colors["background"])
    assert ratio >= minimum, f"{selector}: contrast {ratio:.2f} < {minimum} ({colors})"


def visit(page, path: str) -> None:
    response = page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
    assert response and response.ok, f"{path}: HTTP failure"
    assert page.locator("main#main-content").count() == 1, f"{path}: missing main landmark"
    assert page.locator("h1").count() == 1, f"{path}: must have exactly one h1"


def main() -> None:
    console_errors: list[str] = []
    page_errors: list[str] = []
    external_requests: set[str] = set()
    checks: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page = context.new_page()
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        def capture_request(request) -> None:
            parsed = urlparse(request.url)
            if parsed.scheme in {"http", "https"} and parsed.hostname not in {"127.0.0.1", "localhost"}:
                external_requests.add(request.url)

        page.on("request", capture_request)

        visit(page, "/zh-tw/")
        assert page.locator(".app-sidebar").count() == 0, "Landing must not render App Shell sidebar"
        assert page.locator(".tool-card").count() == 8
        assert page.locator("text=NEW").count() >= 1 and page.locator("text=PRO").count() >= 1
        assert_no_overflow(page, "desktop landing")
        assert_contrast(page, "body")
        assert_contrast(page, ".landing-hero__intro")
        page.screenshot(path=str(ARTIFACTS / "landing-desktop-light.png"), full_page=True)
        checks.append("desktop landing")

        card = page.locator(".tool-card").first
        assert card.evaluate("el => getComputedStyle(el).boxShadow") == "none"
        card.hover()
        page.wait_for_timeout(180)
        assert card.evaluate("el => getComputedStyle(el).boxShadow") == "none"
        checks.append("shadow-free card hover")

        search = page.get_by_role("searchbox", name="搜尋全部工具")
        search.fill("JSON")
        assert page.locator(".tool-search__result").count() == 1
        page.keyboard.press("Tab")
        assert page.evaluate("getComputedStyle(document.activeElement).outlineStyle") != "none"
        checks.append("local search and keyboard focus")

        visit(page, "/zh-tw/tools/")
        assert page.locator(".app-sidebar").is_visible()
        assert page.locator(".mobile-nav").is_hidden()
        assert page.locator(".sidebar-group__title svg").count() == 0
        assert page.get_by_text("收合導覽", exact=True).count() == 0
        assert page.locator(".app-sidebar button[aria-expanded] svg").count() == 1
        primary_links = page.locator(".sidebar-primary-link")
        first_link_box = primary_links.nth(0).bounding_box()
        second_link_box = primary_links.nth(1).bounding_box()
        assert first_link_box and second_link_box
        assert second_link_box["y"] - (first_link_box["y"] + first_link_box["height"]) >= 7
        page.screenshot(path=str(ARTIFACTS / "tool-directory-desktop-light.png"), full_page=True)
        expanded_width = page.locator(".app-sidebar").evaluate("el => el.getBoundingClientRect().width")
        page.locator(".app-sidebar button[aria-expanded]").click()
        page.wait_for_timeout(250)
        collapsed_width = page.locator(".app-sidebar").evaluate("el => el.getBoundingClientRect().width")
        assert collapsed_width < expanded_width
        checks.append("collapsible desktop sidebar")

        visit(page, "/zh-tw/tools/ntd-uppercase/")
        page.locator("#ntd-amount").fill("10001.09")
        assert "新台幣壹萬零壹元玖分" in page.locator(".result-panel").inner_text()
        assert not external_requests, f"Tool interaction made external requests: {sorted(external_requests)}"
        checks.append("local NTD workspace")

        visit(page, "/en/tools/json-formatter/")
        assert page.locator("html").get_attribute("lang") == "en"
        assert "Roboto" in page.locator("body").evaluate("el => getComputedStyle(el).fontFamily")
        assert page.locator("link[rel='canonical']").get_attribute("href") == "https://toolsliang.com/en/tools/json-formatter/"
        assert page.locator("link[hreflang='zh-Hant-TW']").count() == 1
        checks.append("locale, canonical, hreflang")

        visit(page, "/zh-tw/design-system/")
        assert page.locator(".swatch-card").count() == 10
        assert page.locator(".component-showcase").count() == 1
        primary = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim().toLowerCase()")
        assert primary == "#ff8c42", f"Unexpected primary token: {primary}"
        assert_contrast(page, ".ui-button--default")
        page.screenshot(path=str(ARTIFACTS / "design-system-desktop-light.png"), full_page=True)
        checks.append("design system inventory")

        theme_button = page.get_by_role("button", name="切換色彩模式")
        theme_button.click()
        page.wait_for_timeout(120)
        assert "dark" in (page.locator("html").get_attribute("class") or "")
        page.screenshot(path=str(ARTIFACTS / "design-system-desktop-dark.png"), full_page=True)
        assert_contrast(page, "body")
        assert_contrast(page, ".ui-button--default")
        checks.append("dark theme")

        visit(page, "/zh-tw/?variant=A")
        assert page.locator("[class*='prototype-switcher']").count() == 0
        assert "事情處理好" in page.locator("h1").inner_text()
        checks.append("no prototype variants or switcher")

        page.emulate_media(reduced_motion="reduce")
        visit(page, "/zh-tw/design-system/")
        duration = page.locator(".motion-dot").evaluate("el => parseFloat(getComputedStyle(el).animationDuration)")
        assert duration <= 0.001, f"Reduced-motion animation duration is {duration}s"
        checks.append("prefers-reduced-motion")
        page.emulate_media(reduced_motion="no-preference")

        for width, height, label in [(375, 812, "phone"), (768, 1024, "tablet")]:
            page.set_viewport_size({"width": width, "height": height})
            visit(page, "/zh-tw/tools/")
            assert page.locator(".app-sidebar").is_hidden()
            assert page.locator(".mobile-nav").is_visible()
            assert_no_overflow(page, label)
            if width == 375:
                targets = page.locator(".mobile-nav a")
                for index in range(targets.count()):
                    box = targets.nth(index).bounding_box()
                    assert box and box["height"] >= 44 and box["width"] >= 44
                page.screenshot(path=str(ARTIFACTS / "tool-directory-mobile.png"), full_page=True)
            checks.append(label)

        page.set_viewport_size({"width": 1440, "height": 1000})
        visit(page, "/zh-tw/tools/")
        assert_no_overflow(page, "desktop directory")
        assert not external_requests, f"External requests detected: {sorted(external_requests)}"
        assert not console_errors, f"Console errors: {console_errors}"
        assert not page_errors, f"Page errors: {page_errors}"
        checks.append("console and network clean")

        context.close()
        browser.close()

    print(json.dumps({
        "status": "passed",
        "checks": checks,
        "screenshots": [str(path) for path in sorted(ARTIFACTS.glob("*.png"))],
        "console_errors": console_errors,
        "page_errors": page_errors,
        "external_requests": sorted(external_requests),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
