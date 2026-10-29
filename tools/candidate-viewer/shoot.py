import sys, asyncio, json, io
from playwright.async_api import async_playwright
async def main(jobs):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=__import__('os').environ.get('CHROME_PATH','/opt/pw-browsers/chromium-1194/chrome-linux/chrome'),args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'])
        for url,out,w,h in jobs:
            pg=await b.new_page(viewport={'width':w,'height':h})
            msgs=[]; pg.on('console',lambda m:msgs.append(m.text)); pg.on('pageerror',lambda e:msgs.append(str(e)))
            await pg.goto(url); 
            try: await pg.wait_for_function('window.DONE||window.ERR',timeout=120000)
            except Exception as e: print('timeout',msgs)
            err=await pg.evaluate('window.ERR||null')
            if err: print('ERR',out,err,msgs)
            await pg.screenshot(path=out); await pg.close(); print('wrote',out)
        await b.close()
if __name__=='__main__':
    jobs=json.loads(sys.argv[1]); asyncio.run(main(jobs))
