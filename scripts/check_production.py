from urllib.request import urlopen


with urlopen("http://127.0.0.1:4174/zh-tw/?variant=A", timeout=10) as response:
    html = response.read().decode("utf-8")

assert "prototype-switcher" not in html, "Prototype switcher rendered in production HTML"
assert "Prototype 方案切換器" not in html, "Prototype switcher label rendered in production HTML"
assert "<h1" in html, "Variant content missing from production HTML"
print("PASS: production HTML renders the variant without the prototype switcher")
