"""Browser acceptance and WebGL measurements for a built TerraVox client.
Usage: python scripts/test-forest-browser.py DIST OUTPUT [WIDTH HEIGHT]
Install Playwright for Python and its Chromium/ffmpeg, or set TVX_CHROME.
"""
import argparse
import json
import os
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import monotonic
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('dist', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('width', type=int, nargs='?', default=1280)
parser.add_argument('height', type=int, nargs='?', default=720)
args = parser.parse_args()
args.output.mkdir(exist_ok=True, parents=True)
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=args.dist))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}'
errors = []
loaded = set()
probe = """
window.frames3D=[];window.calls=0;
for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
  const draw=WebGL2RenderingContext.prototype[key];
  WebGL2RenderingContext.prototype[key]=function(...args){window.calls++;return draw.apply(this,args)};
}
let previous=0;
function sample(t){
  if(window.calls && previous)window.frames3D.push([t-previous,window.calls]);
  previous=t;window.calls=0;requestAnimationFrame(sample);
}
requestAnimationFrame(sample);
"""
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('TVX_CHROME'), args=os.getenv('TVX_CHROME_ARGS','').split())
    context = browser.new_context(viewport={'width':args.width,'height':args.height}, record_video_dir=args.output if os.getenv('TVX_VIDEO') else None)
    def offline(route):
        if urlsplit(route.request.url).scheme in ('http','https') and not route.request.url.startswith(url+'/'):
            route.abort()
        else:
            route.continue_()
    context.route('**/*',offline)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response',lambda res: loaded.add(res.url.split('/')[-1]) if res.ok and res.url.endswith('.glb') else None)
    page.add_init_script(probe)
    page.goto(url)
    page.get_by_placeholder('Nome do Jogador').fill('Auditoria')
    page.locator('button[type=submit]').click()
    entry = page.get_by_role('button',name=re.compile('Explorar laboratório 3D',re.I))
    start = monotonic()
    entry.click()
    page.wait_for_function('window.frames3D.length >= 4', timeout=120000)
    first_frames = monotonic()-start
    page.wait_for_timeout(2000)
    page.screenshot(path=args.output/'entrada.jpg',type='jpeg',timeout=120000)
    page.keyboard.press('Escape')
    page.get_by_role('dialog').wait_for()
    page.get_by_role('button',name='Continuar exploração').click()
    # Warm the scene before sampling so compilation is reported separately from the route.
    page.wait_for_timeout(3000)
    page.evaluate('window.frames3D=[]')
    page.keyboard.down('w')
    page.wait_for_timeout(1200)
    page.keyboard.up('w')
    # Sample only while stationary. A remote driver can take long enough between
    # observing the prompt and releasing W to run completely through its radius.
    portal = page.get_by_role('button', name=re.compile('Ativar portal'))
    discovered = page.get_by_text('Portal encontrado', exact=True)
    deadline = monotonic() + 150
    page.keyboard.down('Shift')
    while not portal.is_visible():
        if monotonic() > deadline:
            raise AssertionError('Portal approach failed: ' + page.locator('main').inner_text())
        key = 's' if discovered.is_visible() else 'w'
        page.keyboard.down(key)
        page.wait_for_timeout(220)
        page.keyboard.up(key)
    page.keyboard.up('Shift')
    result = page.evaluate("""()=>{const gl=document.querySelector('canvas').getContext('webgl2');
      const ext=gl.getExtension('WEBGL_debug_renderer_info');
      return {frames:frames3D.slice(),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',
        jsHeapBytes:performance.memory?.usedJSHeapSize??null,buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight]}}""")
    assert {'environment.glb','spirit.glb','explorer.glb','portal.glb'} <= loaded
    frames = result.pop('frames')
    times = sorted(ms for ms,_ in frames if ms>0)
    draws = sorted(n for _,n in frames)
    result.update(viewport=[args.width,args.height],sampleFrames=len(times),averageFPS=round(1000*len(times)/sum(times),2),
                  p95FrameMs=round(times[int((len(times)-1)*.95)],2),medianDrawCalls=draws[len(draws)//2],
                  entryToFourFramesSeconds=round(first_frames,2),models=sorted(loaded))
    page.keyboard.press('e')
    page.get_by_text('Portal ativado. O beija-luz',exact=False).wait_for()
    page.wait_for_timeout(1200)
    page.screenshot(path=args.output/'portal.jpg',type='jpeg',timeout=120000)
    page.set_viewport_size({'width':960,'height':640})
    page.keyboard.press('Escape')
    page.get_by_role('button',name='Reiniciar exploração').click()
    page.get_by_text('31 m',exact=True).wait_for()
    page.evaluate("""()=>{let gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');
      if(!ext)throw Error('WEBGL_lose_context unavailable');ext.loseContext();setTimeout(()=>ext.restoreContext(),800)}""")
    page.wait_for_timeout(1600)
    page.evaluate('window.frames3D=[]')
    page.wait_for_function('frames3D.length>3',timeout=60000)
    page.get_by_role('button',name='Voltar ao mapa').click()
    entry.wait_for()
    assert not errors, errors
    result['checks']=['local assets only','map entry','pause and resume','sprint to portal','activate','resize','restart','WebGL restore','return to map']
    print(json.dumps(result,indent=2))
    (args.output/'medicao.json').write_text(json.dumps(result,indent=2))
    context.close()
    browser.close()
server.shutdown()
