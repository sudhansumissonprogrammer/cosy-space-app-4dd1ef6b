import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(headless=True)
        ctx=await b.new_context(**pw.devices["iPhone 13"], service_workers="block")
        p=await ctx.new_page()
        await p.goto("https://serdiya.com/product/chain-x1ga?v=44",wait_until="commit")
        await p.wait_for_timeout(6000)
        print(await p.evaluate("()=>({t:document.title,h1:document.querySelector('h1')?.innerText.slice(0,60),root:document.getElementById('root').innerHTML.length,imgs:[...document.images].filter(i=>i.complete&&i.naturalWidth>80).length})"))
        await p.screenshot(path="/tmp/browser/livetest/shots/serdiya_pdp_full.png")
        await b.close()
asyncio.run(main())
