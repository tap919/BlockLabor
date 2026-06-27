"""
PrizePicks scraper using Playwright.
"""

import asyncio
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

from playwright.async_api import async_playwright, Page, Browser

PRIZEPICKS_EMAIL = os.getenv("PRIZEPICKS_EMAIL", "")
PRIZEPICKS_PASSWORD = os.getenv("PRIZEPICKS_PASSWORD", "")
BASE_URL = "https://app.prizepicks.com"


class PrizePicksScraper:
    def __init__(self):
        self.browser = None
        self.page = None
    
    async def __aenter__(self):
        pw = await async_playwright().start()
        self.browser = await pw.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120"
        )
        self.page = await self.context.new_page()
        self.page.on("console", lambda msg: print(f"[CONSOLE] {msg.text}"))
        return self
    
    async def __aexit__(self, *args):
        if self.browser:
            await self.browser.close()
    
    async def login(self, email: str, password: str) -> bool:
        """Log in to PrizePicks."""
        print("Navigating to login...")
        await self.page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        await asyncio.sleep(3)
        
        # Print page title and URL
        print(f"URL: {self.page.url}")
        title = await self.page.title()
        print(f"Title: {title}")
        
        # Try to find any input fields
        inputs = await self.page.query_selector_all("input")
        print(f"Found {len(inputs)} input fields")
        
        # List input types
        for i, inp in enumerate(inputs):
            try:
                inp_type = await inp.get_attribute("type")
                inp_placeholder = await inp.get_attribute("placeholder")
                print(f"  Input {i}: type={inp_type}, placeholder={inp_placeholder}")
            except:
                continue
        
        if not inputs:
            # Page might have cloudflare or similar
            print("Waiting more...")
            await asyncio.sleep(5)
            inputs = await self.page.query_selector_all("input")
        
        # Try generic selectors
        try:
            await self.page.fill('input[placeholder*="email"], input[id*="email"], input[name*="email"]', email, timeout=5000)
        except:
            try:
                await self.page.fill('input[type="email"], input[type="text"]', email, timeout=5000)
            except:
                print("Could not fill email")
        
        await self.page.click('button[type="submit"]')
        await asyncio.sleep(3)
        
        # Password
        try:
            await self.page.fill('input[type="password"]', password, timeout=5000)
        except:
            print("Could not fill password")
        
        await self.page.click('button[type="submit"]')
        await asyncio.sleep(5)
        
        print(f"After login: {self.page.url}")
        return True  # Continue regardless
    
    async def get_balance(self) -> float:
        """Get current balance."""
        await self.page.goto(BASE_URL)
        await asyncio.sleep(3)
        
        content = await self.page.content()
        
        # Look for "Balance" label followed by amount
        match = re.search(r'(?:Available)?\s*Balanc(?:e|ce)[:\s]*\$?([0-9,]+\.?\d*)', content, re.I)
        if match:
            return float(match.group(1).replace(',', ''))
        
        # Any dollar amount
        matches = re.findall(r'\$([0-9,]+\.?\d+)', content)
        if matches:
            return float(matches[0].replace(',', ''))
        
        return 0.0


async def main():
    async with PrizePicksScraper() as scraper:
        await scraper.login(PRIZEPICKS_EMAIL, PRIZEPICKS_PASSWORD)
        balance = await scraper.get_balance()
        print(f"Balance: ${balance}")


if __name__ == "__main__":
    asyncio.run(main())