"""Exercise the actual local UI; optionally record real work for at least 90 seconds."""

import argparse
import json
import os
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/results/browser"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--record", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    receipts, errors = [], []
    with (
        tempfile.TemporaryDirectory(prefix="fit-browser-") as temp,
        (OUT / "server.log").open("w") as log,
    ):
        child = subprocess.Popen(
            ["node", "dist-node/src/server.js"],
            cwd=ROOT,
            env={**os.environ, "PORT": "18127", "FIT_DB": str(Path(temp) / "db.sqlite")},
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(100):
                try:
                    urllib.request.urlopen("http://127.0.0.1:18127/api/state", timeout=1).close()
                    break
                except OSError:
                    time.sleep(0.1)
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=p.chromium.executable_path)
                context = browser.new_context(
                    viewport={"width": 1600, "height": 1100},
                    **({"record_video_dir": str(OUT / "recording")} if args.record else {}),
                )
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                start = time.monotonic()
                page.goto("http://127.0.0.1:18127")
                expect(
                    page.get_by_role("heading", name="Good fit? Show your work.")
                ).to_be_visible()
                expect(page.locator(".job")).to_have_count(24)
                for width in [390, 768, 1024, 1600]:
                    page.set_viewport_size({"width": width, "height": 1100})
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (
                        f"overflow at {width}"
                    )
                    page.screenshot(path=str(OUT / f"fit-{width}.png"), full_page=True)
                    receipts.append({"viewport": width, "horizontalOverflow": False})
                page.get_by_label("Posting source").select_option("synthetic")
                expect(page.locator(".job")).to_have_count(12)
                profiles = ["systems", "backend", "frontend", "platform", "data", "mobile"]
                cycle = 0
                while cycle < 1 or (args.record and time.monotonic() - start < 91):
                    for pid in profiles:
                        page.get_by_label("SYNTHETIC CANDIDATE").select_option(pid)
                        expect(page.locator(".sourcehash")).to_have_count(0)
                        page.get_by_role("button", name="Evidence & gaps", exact=True).click()
                        expect(page.locator(".evidence-row").first).to_be_visible()
                        if args.record:
                            page.wait_for_timeout(900)
                        page.get_by_role("button", name="Ranking notebook", exact=True).click()
                        expect(page.locator("table tbody tr")).to_have_count(6)
                        if args.record:
                            page.wait_for_timeout(700)
                        page.get_by_role("button", name="Source-only resume", exact=True).click()
                        expect(page.locator(".sourcehash")).to_contain_text("CV SHA256")
                        page.get_by_role("button", name="Move b03 first", exact=True).click()
                        expect(page.locator(".bullet").first).to_contain_text("b03")
                        page.get_by_role(
                            "button", name="Test a fabricated claim", exact=True
                        ).click()
                        expect(page.get_by_role("status")).to_contain_text("unsupported_bullet")
                        page.get_by_label("Edit token", exact=True).fill("wrong-browser-token")
                        page.get_by_role(
                            "button", name="Verify & save variant ↗", exact=True
                        ).click()
                        expect(page.get_by_role("status")).to_contain_text("edit_token_required")
                        page.get_by_label("Edit token", exact=True).fill("local-edit")
                        page.get_by_role(
                            "button", name="Verify & save variant ↗", exact=True
                        ).click()
                        expect(page.get_by_role("status")).to_contain_text(
                            "exact source permutation"
                        )
                        expect(
                            page.get_by_role("link", name="Download verified Markdown ↓")
                        ).to_be_visible()
                        receipts.append(
                            {
                                "profile": pid,
                                "forgedClaimRejected": True,
                                "wrongTokenRejected": True,
                                "variantSaved": True,
                            }
                        )
                        if args.record:
                            page.wait_for_timeout(1000)
                        page.get_by_role("button", name="Evidence & gaps", exact=True).click()
                    cycle += 1
                page.get_by_label("Posting source").select_option("greenhouse")
                expect(page.locator(".job")).to_have_count(12)
                page.locator(".job").first.click()
                expect(page.get_by_role("link", name="Review original posting ↗")).to_be_visible()
                page.get_by_label("Posting source").select_option("synthetic")
                page.get_by_label("SYNTHETIC CANDIDATE").focus()
                assert page.get_by_label("SYNTHETIC CANDIDATE").evaluate(
                    "e => e === document.activeElement"
                )
                receipts.append({"keyboardFocus": True, "publicSourceLink": True})
                page.screenshot(path=str(OUT / "fit-final.png"), full_page=True)
                duration = time.monotonic() - start
                context.close()
                browser.close()
                assert not errors, errors
                (OUT / "proof.json").write_text(
                    json.dumps(
                        {
                            "receipts": receipts,
                            "pageErrors": errors,
                            "wallSeconds": duration,
                            "recorded": args.record,
                            "scope": "Actual Chromium and local HTTP",
                        },
                        indent=2,
                    )
                    + "\n"
                )
                print(
                    json.dumps(
                        {
                            "receipts": len(receipts),
                            "wallSeconds": duration,
                            "pageErrors": len(errors),
                        }
                    )
                )
        finally:
            child.terminate()
            child.wait(timeout=10)


if __name__ == "__main__":
    main()
