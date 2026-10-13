#!/usr/bin/env python3
"""Maakt de voorbeeldontwerpen voor de gallery op de startpagina.

Gebruik:
  python3 scripts/build_examples.py

Per voorbeeld komt er een projectbestand (voorbeelden/<id>.json) in het formaat van
"Project opslaan" in de editor, plus voorbeelden/index.json met de lijst. De afbeeldingen
(voorbeelden/<id>.png en <id>-512.png) maak je daarna door elk projectbestand in de editor
te openen en te exporteren; zo zien de voorbeelden er precies zo uit als in de editor.
"""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'voorbeelden'
MODELS = {m['id']: m for m in json.loads((ROOT / 'assets/templates/index.json').read_text(encoding='utf8'))['models']}


def panels_of(model_id):
    return json.loads((ROOT / f'assets/templates/{model_id}/panels.json').read_text(encoding='utf8'))


def fill(layer_id, color, color2=None, angle=90):
    return {
        'id': layer_id,
        'type': 'fill',
        'name': 'Achtergrond',
        'visible': True,
        'opacity': 1,
        'panels': None,
        'color': color,
        'color2': color2 or color,
        'gradient': color2 is not None,
        'angle': angle,
    }


def paint(layer_id, name, strokes):
    return {'id': layer_id, 'type': 'paint', 'name': name, 'visible': True, 'opacity': 1, 'panels': None, 'strokes': strokes}


def stroke(points, color, width, sym=None):
    s = {'c': color, 'w': width, 'e': False, 'p': [round(v, 1) for xy in points for v in xy]}
    if sym is not None:
        s['sym'] = sym  # streek wordt ook op de spiegelas gespiegeld getekend
    return s


def rode_lijnen(w, h, axis):
    line = [(axis - 42, -20), (axis - 42, h + 20)]
    return [fill('a1', '#1b1f26'), paint('a2', 'Racestrepen', [stroke(line, '#d24b43', 64, axis), stroke(line, '#ffffff', 6, axis)])]


def zonsondergang(w, h, axis):
    return [fill('b1', '#ff7a18', '#7b2ff7', 90), paint('b2', 'Horizon', [stroke([(-20, h * 0.55), (w + 20, h * 0.55)], '#ffffff', 12)])]


def carbon(w, h, axis):
    strokes = [stroke([(k * 46, -20), (k * 46 + h + 40, h + 20)], '#3a404a', 5) for k in range(-14, 32)]
    return [fill('c1', '#2b2f36', '#15181d', 45), paint('c2', 'Carbon', strokes)]


def blauwe_golven(w, h, axis):
    strokes = []
    for i in range(5):
        base = h * (0.15 + 0.18 * i)
        pts = [(x, base + 40 * math.sin(2 * math.pi * x / 400 + i * 0.9)) for x in range(-20, w + 40, 16)]
        strokes.append(stroke(pts, '#3da5ff', 16))
    return [fill('d1', '#0b3d66', '#06223b', 90), paint('d2', 'Golven', strokes)]


def industrieel(w, h, axis):
    strokes = [stroke([(-20, y), (w + 20, y)], '#4b5260', 8) for y in range(0, h + 1, 96)]
    strokes += [stroke([(x, -20), (x, h + 20)], '#4b5260', 8) for x in range(0, w + 1, 128)]
    strokes.append(stroke([(-20, h / 2), (w + 20, h / 2)], '#ff8c00', 40))
    return [fill('e1', '#8a929c'), paint('e2', 'Raster', strokes)]


def minimaal(w, h, axis):
    return [fill('f1', '#f2f2f2'), paint('f2', 'Lijn', [stroke([(axis, -20), (axis, h + 20)], '#111111', 10)])]


def neon(w, h, axis):
    def zigzag(x_center, amp=26, step=40):
        pts = []
        for i, y in enumerate(range(-20, h + 41, step)):
            pts.append((x_center + (amp if i % 2 else -amp), y))
        return pts

    return [
        fill('g1', '#0a0a0a'),
        paint('g2', 'Neon', [stroke(zigzag(axis - 200), '#00e5ff', 8, axis), stroke(zigzag(axis - 250), '#ff2bd6', 8, axis)]),
    ]


def waarschuwing(w, h, axis):
    strokes = [stroke([(k * 170, -20), (k * 170 + h + 40, h + 20)], '#ffd400', 70) for k in range(-6, 14)]
    return [fill('h1', '#111111'), paint('h2', 'Strepen', strokes)]


EXAMPLES = [
    ('rode-lijnen', 'Rode lijnen', 'model3-2024-base', rode_lijnen, 'Donkergrijs met twee rode racestrepen over het midden.'),
    ('zonsondergang', 'Zonsondergang', 'modely-2025-base', zonsondergang, 'Een verloop van oranje naar paars met een witte horizon.'),
    ('carbon', 'Carbon', 'models-2025-plaid', carbon, 'Een donker verloop met fijne diagonale lijnen.'),
    ('blauwe-golven', 'Blauwe golven', 'modelx-2021', blauwe_golven, 'Lichtblauwe golven over een diepblauwe basis.'),
    ('industrieel', 'Industrieel', 'cybertruck', industrieel, 'Staalgrijs met een raster en één oranje streep.'),
    ('minimaal', 'Minimaal', 'modely-l', minimaal, 'Lichtgrijs met één zwarte lijn over het midden.'),
    ('neon', 'Neon', 'model3-2024-performance', neon, 'Zwart met een cyaan en een magenta zigzag langs de zijkanten.'),
    ('waarschuwing', 'Waarschuwing', 'modely-2025-performance', waarschuwing, 'Zwarte basis met gele diagonale strepen.'),
]


def main():
    OUT.mkdir(exist_ok=True)
    index = []
    for ex_id, name, model_id, build, description in EXAMPLES:
        meta = panels_of(model_id)
        layers = build(meta['width'], meta['height'], meta['axis'])
        project = {'format': 'tesla-wrap-project', 'version': 2, 'name': name, 'model': model_id, 'layers': layers, 'assets': {}}
        (OUT / f'{ex_id}.json').write_text(json.dumps(project, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
        index.append({
            'id': ex_id,
            'name': name,
            'model': model_id,
            'modelName': MODELS[model_id]['name'],
            'group': MODELS[model_id]['group'],
            'description': description,
            'image': f'voorbeelden/{ex_id}.png',
            'thumb': f'voorbeelden/{ex_id}-512.png',
        })
    (OUT / 'index.json').write_text(json.dumps({'examples': index}, ensure_ascii=False, indent=2), encoding='utf8')
    print(f'{len(index)} voorbeelden geschreven naar {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
