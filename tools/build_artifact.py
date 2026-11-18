"""Crea una pagina unica (dist/precisionfert-demo.html) con librerie e dati incorporati,
per pubblicarla come pagina Claude o aprirla offline. Uso: python3 tools/build_artifact.py"""
import json, pathlib, re
R = pathlib.Path(__file__).resolve().parent.parent
app = R / 'app'
html = (app / 'index.html').read_text(encoding='utf-8')
esc = lambda s: s.replace('</script', '<\\/script')
css = (app / 'vendor/leaflet.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="vendor/leaflet.css">', '<style>' + css + '</style>')
repo = {str(p.relative_to(R / 'repository')): p.read_text(encoding='utf-8') for p in (R / 'repository').rglob('*') if p.is_file()}
def inline(m):
    src = m.group(1)
    code = (app / src).read_text(encoding='utf-8')
    pre = ('<script>window.REPO_INLINE=' + esc(json.dumps(repo, ensure_ascii=False)) + ';</script>\n') if src == 'motore.js' else ''
    return pre + '<script>' + esc(code) + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
(R / 'dist').mkdir(exist_ok=True)
(R / 'dist/precisionfert-demo.html').write_text(html, encoding='utf-8')
print('ok', len(html) // 1024, 'KB')
