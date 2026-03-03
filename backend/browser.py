"""
Playwright-based browser automation for Google services.
Uses a dedicated Chrome profile for Playwright to avoid conflicts with running Chrome.
"""

import asyncio
import os
import re
import shutil
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# Use a dedicated profile directory for Playwright (not the main Chrome profile)
PLAYWRIGHT_PROFILE_DIR = os.path.join(os.path.dirname(__file__), ".playwright_profile")
BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "false").lower() == "true"

# Cache for auth status (5 min TTL)
_auth_cache: dict = {"email": None, "timestamp": 0}
AUTH_CACHE_TTL = 300  # 5 minutes

# Global browser instance for reuse
_browser_instance = None
_playwright_instance = None


async def _get_browser_context():
    """Launch Playwright with a dedicated profile directory."""
    global _browser_instance, _playwright_instance
    
    from playwright.async_api import async_playwright

    # Create profile directory if not exists
    os.makedirs(PLAYWRIGHT_PROFILE_DIR, exist_ok=True)

    playwright = await async_playwright().start()

    # Use chromium with dedicated user data dir
    browser = await playwright.chromium.launch_persistent_context(
        user_data_dir=PLAYWRIGHT_PROFILE_DIR,
        headless=BROWSER_HEADLESS,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--no-default-browser-check",
        ],
    )
    return playwright, browser


async def check_google_auth() -> dict:
    """
    Check if user is logged into Google by visiting google.com.
    Returns: { logged_in: bool, email: str | None }
    """
    import time

    # Check cache
    if time.time() - _auth_cache["timestamp"] < AUTH_CACHE_TTL:
        return {"logged_in": _auth_cache["email"] is not None, "email": _auth_cache["email"]}

    playwright = None
    browser = None
    try:
        playwright, browser = await _get_browser_context()
        page = await browser.new_page()

        # Go to Google account page
        await page.goto("https://myaccount.google.com/", wait_until="domcontentloaded")
        await asyncio.sleep(2)

        # Check if logged in by looking for email/profile element
        email = None

        # Try to find email in the page
        try:
            # Look for email in account page
            email_elem = await page.query_selector('[data-email]')
            if email_elem:
                email = await email_elem.get_attribute("data-email")

            if not email:
                # Try another selector
                email_elem = await page.query_selector('a[aria-label*="@"]')
                if email_elem:
                    label = await email_elem.get_attribute("aria-label")
                    if label and "@" in label:
                        match = re.search(r'[\w\.-]+@[\w\.-]+', label)
                        if match:
                            email = match.group(0)

            if not email:
                # Check page content for email pattern
                content = await page.content()
                match = re.search(r'[\w\.-]+@gmail\.com', content)
                if match:
                    email = match.group(0)

        except Exception:
            pass

        # Update cache
        _auth_cache["email"] = email
        _auth_cache["timestamp"] = time.time()

        return {"logged_in": email is not None, "email": email}

    except Exception as e:
        return {"logged_in": False, "email": None, "error": str(e)}
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()


async def get_slides_content(presentation_id: str) -> str:
    """
    Extract text content from a Google Slides presentation.
    Uses Playwright to navigate and scrape slide content.
    """
    playwright = None
    browser = None
    try:
        playwright, browser = await _get_browser_context()
        page = await browser.new_page()

        url = f"https://docs.google.com/presentation/d/{presentation_id}/edit"
        await page.goto(url, wait_until="domcontentloaded")
        await asyncio.sleep(3)  # Wait for slides to load

        # Extract text from all slides
        text_parts = []

        # Get all text elements from the presentation
        # Google Slides uses SVG and specific class names
        text_elements = await page.query_selector_all('[class*="punch-viewer-content"] text, .punch-viewer-svgpage text')

        for elem in text_elements:
            try:
                text = await elem.text_content()
                if text and text.strip():
                    text_parts.append(text.strip())
            except Exception:
                pass

        # Also try to get text from the filmstrip (slide thumbnails)
        if not text_parts:
            # Alternative: use keyboard to navigate and extract
            # This is a fallback approach
            content = await page.content()
            # Extract visible text patterns
            matches = re.findall(r'>([^<]{10,})<', content)
            text_parts = [m.strip() for m in matches if m.strip() and not m.startswith('{')]

        return "\n".join(text_parts)

    except Exception as e:
        raise ValueError(f"Failed to extract slides content: {str(e)}")
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()


async def list_notebooklm_notebooks() -> list:
    """
    List all notebooks from NotebookLM.
    Returns: [{id, name, url}]
    """
    playwright = None
    browser = None
    try:
        playwright, browser = await _get_browser_context()
        page = await browser.new_page()

        await page.goto("https://notebooklm.google.com/", wait_until="domcontentloaded")
        await asyncio.sleep(3)

        notebooks = []

        # Look for notebook cards/links
        # NotebookLM UI may vary, try multiple selectors
        notebook_elements = await page.query_selector_all('a[href*="/notebook/"]')

        for elem in notebook_elements:
            try:
                href = await elem.get_attribute("href")
                name_elem = await elem.query_selector('[class*="title"], [class*="name"], span')
                name = await name_elem.text_content() if name_elem else "Untitled"

                # Extract notebook ID from URL
                match = re.search(r'/notebook/([a-zA-Z0-9_-]+)', href or "")
                if match:
                    nb_id = match.group(1)
                    notebooks.append({
                        "id": nb_id,
                        "name": name.strip() if name else "Untitled",
                        "url": f"https://notebooklm.google.com/notebook/{nb_id}",
                    })
            except Exception:
                pass

        return notebooks

    except Exception as e:
        return [{"error": str(e)}]
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()


async def upload_to_notebooklm(notebook_url: str, file_path: str, progress_callback=None) -> dict:
    """
    Upload a text file to a NotebookLM notebook.
    Returns: {success: bool, message: str}
    """
    playwright = None
    browser = None
    try:
        playwright, browser = await _get_browser_context()
        page = await browser.new_page()

        if progress_callback:
            await progress_callback(f"Opening notebook: {notebook_url}")

        await page.goto(notebook_url, wait_until="domcontentloaded")
        await asyncio.sleep(3)

        if progress_callback:
            await progress_callback("Looking for 'Add source' button...")

        # Find and click "Add source" or "+" button
        add_btn = await page.query_selector('button:has-text("Add source"), button:has-text("Add"), [aria-label*="Add"]')

        if not add_btn:
            # Try finding by icon or other patterns
            add_btn = await page.query_selector('[class*="add"], [class*="upload"]')

        if add_btn:
            await add_btn.click()
            await asyncio.sleep(2)

            if progress_callback:
                await progress_callback("Uploading file...")

            # Look for file input
            file_input = await page.query_selector('input[type="file"]')
            if file_input:
                await file_input.set_input_files(file_path)
                await asyncio.sleep(3)

                if progress_callback:
                    await progress_callback("Waiting for processing...")

                # Wait for upload to complete
                await asyncio.sleep(5)

                return {"success": True, "message": f"Uploaded {Path(file_path).name}"}
            else:
                return {"success": False, "message": "Could not find file input"}
        else:
            return {"success": False, "message": "Could not find 'Add source' button"}

    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        if browser:
            await browser.close()
        if playwright:
            await playwright.stop()


# Synchronous wrappers for use in FastAPI
def check_google_auth_sync() -> dict:
    """Synchronous wrapper for check_google_auth."""
    return asyncio.run(check_google_auth())


def get_slides_content_sync(presentation_id: str) -> str:
    """Synchronous wrapper for get_slides_content."""
    return asyncio.run(get_slides_content(presentation_id))


def list_notebooklm_notebooks_sync() -> list:
    """Synchronous wrapper for list_notebooklm_notebooks."""
    return asyncio.run(list_notebooklm_notebooks())


def upload_to_notebooklm_sync(notebook_url: str, file_path: str) -> dict:
    """Synchronous wrapper for upload_to_notebooklm."""
    return asyncio.run(upload_to_notebooklm(notebook_url, file_path))
