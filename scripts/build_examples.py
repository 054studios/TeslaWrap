#!/usr/bin/env python3
"""Maakt de voorbeeldontwerpen voor de galerij: tien ontwerpen voor elk van de twaalf modellen.

Gebruik, vanuit de repo-root:
  python3 scripts/build_examples.py                         projecten en voorbeelden/index.json
  NODE_PATH=$(npm root -g) node scripts/render_examples.js  PNG's, geëxporteerd met de editor zelf
  python3 scripts/build_examples.py --thumbs                miniaturen van 512 px, daarna de controles
  python3 scripts/build_examples.py --check                 alleen de controles

Een ontwerp is een projectbestand (voorbeelden/<model>-<nn>.json) in het formaat van "Project opslaan"
in de editor. Er zijn tien families (FAMILIES); elke familie is een functie die de lagen voor één model
maakt. Elk ontwerp heeft een vaste seed: een hash van het model-id en het familienummer. De seed varieert
de positie, de hoek (±8°), de lijndikte (±15%) en de lichtheid van de kleuren (±4%, dezelfde tint). Zo
heeft elk model zijn eigen tien ontwerpen, en zijn geen twee ontwerpen gelijk.

Varianten van dezelfde auto (bijvoorbeeld de vijf Model Y's) hebben bijna hetzelfde sjabloon. Daarom
verschillen ze per familie in minstens één van de twee best zichtbare parameters minstens SPREAD van het
bereik. Komt een seed te dicht bij die van een eerdere variant, dan krijgt de variant de volgende seed
(de hash met #1, #2, ...). Dat blijft vast: dezelfde invoer geeft altijd dezelfde ontwerpen.

Lijnen die maar op één plek liggen (de horizon, de oranje streep, de zigzag) komen op een plek waar ze
over de panelen lopen. Het script meet dat met het paneelmasker (assets/templates/<model>/mask.png).

Nodig: Pillow (pip install pillow).
"""
import collections
import colorsys
import hashlib
import json
import math
import pathlib
import random
import re
import sys

from PIL import Image, ImageChops, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'voorbeelden'
MODELS = json.loads((ROOT / 'assets/templates/index.json').read_text(encoding='utf8'))['models']
MAX_BYTES = 1_000_000  # zoals js/export.js
THUMB_WIDTH = 512
TESLA_NAME = re.compile(r'[A-Za-z0-9_-]+\.png')  # Tesla-eis: letters, cijfers, '-' en '_', maximaal 30 tekens
TESLA_MAX = 30
SPREAD = 0.2  # minimale afstand (deel van het bereik) tussen varianten van dezelfde auto, zie variation()


# --- sjabloon en variatie ---------------------------------------------------------------


class Template:
    """Afmeting, spiegelas en paneelmasker van één model."""

    def __init__(self, model):
        folder = ROOT / 'assets/templates' / model['id']
        meta = json.loads((folder / 'panels.json').read_text(encoding='utf8'))
        self.model = model
        self.w, self.h, self.axis = meta['width'], meta['height'], meta['axis']
        mask = Image.open(folder / 'mask.png').convert('L')
        if mask.size != (self.w, self.h):
            mask = mask.resize((self.w, self.h), Image.NEAREST)
        self.mask = mask  # per pixel het paneel-id, 0 = buiten de panelen
        self._px = mask.load()

    def inside(self, x, y):
        xi, yi = math.floor(x), math.floor(y)
        return 0 <= xi < self.w and 0 <= yi < self.h and self._px[xi, yi] > 0

    def touches(self, x, y, r):
        """Ligt een stip met straal r (deels) op een paneel?"""
        return self.inside(x, y) or any(
            self.inside(x + r * math.cos(k * math.pi / 4), y + r * math.sin(k * math.pi / 4)) for k in range(8)
        )

    def cover(self, points, width=0.0, clearance=0.0, step=3.0):
        """Lengtes in px: (helemaal op een paneel, deels op een paneel). Helemaal telt als de hele streep
        (width) op een paneel ligt, met clearance px ruimte aan beide kanten. Deels is een streep die maar
        half op een paneel ligt, bijvoorbeeld langs de rand."""
        reach = width / 2 + clearance
        offsets = (0.0,) if reach <= 0 else (-reach, 0.0, reach)
        full = part = 0.0
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            length = math.hypot(x1 - x0, y1 - y0)
            if not length:
                continue
            nx, ny = (y0 - y1) / length, (x1 - x0) / length
            n = max(1, round(length / step))
            for i in range(n):
                x = x0 + (x1 - x0) * (i + 0.5) / n
                y = y0 + (y1 - y0) * (i + 0.5) / n
                hits = sum(self.inside(x + o * nx, y + o * ny) for o in offsets)
                if hits == len(offsets):
                    full += length / n
                elif hits:
                    part += length / n
        return full, part

    def visible(self, points, sym=None, width=0.0):
        """Lengte in px van de lijn die helemaal op de panelen ligt; met sym telt de gespiegelde lijn mee."""
        total = self.cover(points, width)[0]
        if sym is not None:
            total += self.cover([(2 * sym - x, y) for x, y in points], width)[0]
        return total

    def reach(self, cx, cy):
        """Afstand van (cx, cy) tot de verste hoek van het canvas."""
        return max(math.hypot(cx - x, cy - y) for x in (0, self.w) for y in (0, self.h))


_TEMPLATES = {}


def template(model_id):
    if model_id not in _TEMPLATES:
        _TEMPLATES[model_id] = Template(next(m for m in MODELS if m['id'] == model_id))
    return _TEMPLATES[model_id]


def seed_of(model_id, nn, salt=0):
    """Vaste seed per ontwerp: een hash van het model-id en het familienummer (en zo nodig een teller)."""
    key = f'{model_id}-{nn:02d}' + (f'#{salt}' if salt else '')
    return int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], 'big')


class Variation:
    """De variatie van één ontwerp. Elke familie past die toe op haar eigen lijnen en kleuren."""

    RANGES = {'pos': (-1, 1), 'pos2': (-1, 1), 'pick': (0, 1), 'angle': (-8, 8), 'width': (0.85, 1.15), 'light': (-0.04, 0.04)}

    def __init__(self, model_id, nn, salt=0):
        rng = random.Random(seed_of(model_id, nn, salt))
        self.salt = salt
        self.pos = rng.uniform(-1, 1)  # positie (elke familie rekent dit om naar pixels)
        self.pos2 = rng.uniform(-1, 1)  # tweede positie, bijvoorbeeld de fase van een patroon
        self.pick = rng.random()  # keuze tussen plekken waar een lijn goed over de panelen loopt
        self.angle = rng.uniform(-8, 8)  # hoek in graden
        self.width = rng.uniform(0.85, 1.15)  # factor op de lijndikte
        self.light = rng.uniform(-0.04, 0.04)  # verschuiving van de lichtheid

    def distance(self, other, params):
        """Grootste verschil in params, als deel van het bereik (0 tot 1)."""
        return max(abs(getattr(self, p) - getattr(other, p)) / (self.RANGES[p][1] - self.RANGES[p][0]) for p in params)

    def shade(self, color):
        """Dezelfde kleur (zelfde tint en verzadiging), met de lichtheid van dit ontwerp."""
        r, g, b = (int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
        hue, light, sat = colorsys.rgb_to_hls(r, g, b)
        r, g, b = colorsys.hls_to_rgb(hue, min(1.0, max(0.0, light + self.light)), sat)
        return '#' + ''.join(f'{round(c * 255):02x}' for c in (r, g, b))


# --- lagen, zoals de editor ze bewaart ---------------------------------------------------


def fill(layer_id, color, color2=None, angle=90):
    """Kleurvlak over de hele wrap. Met color2 een verloop onder de hoek angle (graden)."""
    return {
        'id': layer_id,
        'type': 'fill',
        'name': 'Basis' if color2 is None else 'Verloop',
        'visible': True,
        'opacity': 1,
        'panels': None,
        'color': color,
        'color2': color2 or color,
        'gradient': color2 is not None,
        'angle': round(angle),
    }


def paint(layer_id, name, strokes):
    return {'id': layer_id, 'type': 'paint', 'name': name, 'visible': True, 'opacity': 1, 'panels': None, 'strokes': strokes}


def stroke(points, color, width, sym=None):
    """Een penseelstreek in canvas-pixels. Met sym (de spiegelas) tekent de editor hem ook gespiegeld.
    Een streek van één punt is een stip met diameter width."""
    return {'c': color, 'w': round(width, 1), 'e': False, 'sym': sym, 'p': [round(v, 1) for xy in points for v in xy]}


# --- geometrie ---------------------------------------------------------------------------------


def rotate(points, angle, cx, cy):
    a = math.radians(angle)
    c, s = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in points]


def clip(p0, p1, t, margin):
    """Het deel van lijnstuk p0-p1 binnen het canvas plus margin (Liang-Barsky), of None."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    lo, hi = 0.0, 1.0
    for p, q in ((-dx, p0[0] + margin), (dx, t.w + margin - p0[0]), (-dy, p0[1] + margin), (dy, t.h + margin - p0[1])):
        if p == 0:
            if q < 0:
                return None
        elif p < 0:
            lo = max(lo, q / p)
        else:
            hi = min(hi, q / p)
    if lo >= hi:
        return None
    return [(p0[0] + lo * dx, p0[1] + lo * dy), (p0[0] + hi * dx, p0[1] + hi * dy)]


def parallel_lines(t, direction, spacing, phase, width):
    """Evenwijdige lijnen over het hele canvas onder direction graden (45 = schuin naar rechtsonder).
    Alleen lijnen die over een paneel lopen."""
    a = math.radians(direction)
    d = (math.cos(a), math.sin(a))
    n = (-math.sin(a), math.cos(a))
    cx, cy = t.axis, t.h / 2
    reach = t.reach(cx, cy) + width
    lines = []
    for k in range(-int(reach / spacing) - 1, int(reach / spacing) + 2):
        off = k * spacing + phase
        ox, oy = cx + n[0] * off, cy + n[1] * off
        seg = clip((ox - d[0] * reach, oy - d[1] * reach), (ox + d[0] * reach, oy + d[1] * reach), t, width / 2 + 20)
        if seg and t.visible(seg) > 0:
            lines.append(seg)
    return lines


def chevron(t, y, angle):
    """Linkerhelft van een lijn over de hele breedte, door (as, y) en angle graden schuin. Met sym op de
    as tekent de editor de rechterhelft gespiegeld: beide zijkanten van de auto krijgen dezelfde lijn."""
    x0 = -30
    return [(x0, y + (t.axis - x0) * math.tan(math.radians(angle))), (t.axis, y)]


def balanced(t, half, width, clearance=8):
    """Score van een streep die de editor spiegelt (sym op de as): de lengte die helemaal op een paneel ligt,
    min twee keer de lengte die maar half op een paneel ligt (langs een rand), aan de kant waar dat het
    slechtst uitkomt. Niet elk sjabloon is precies symmetrisch: bij de Cybertruck zit het raam maar aan
    één kant van het zijpaneel."""
    def score(line):
        full, part = t.cover(line, width, clearance)
        return full - 2 * part

    return 2 * min(score(half), score([(2 * t.axis - x, y) for x, y in half]))


def choose(candidates, score, pick, keep=0.85):
    """Kiest een kandidaat met minstens keep x de beste score. pick (0 tot 1, uit de seed) bepaalt welke."""
    scores = [score(c) for c in candidates]
    best = max(scores)
    good = [c for c, s in zip(candidates, scores) if s >= best - (1 - keep) * abs(best)]
    return good[min(len(good) - 1, int(pick * len(good)))]


def steps(start, stop, step):
    """Zoals range, maar met kommagetallen."""
    out = []
    v = start
    while (step > 0 and v < stop) or (step < 0 and v > stop):
        out.append(v)
        v += step
    return out


# --- de tien families ---------------------------------------------------------------------------
# Elke functie krijgt het sjabloon (t) en de variatie (v) en geeft de lagen van het ontwerp.


def rode_lijnen(t, v):
    """Twee rode strepen met een witte bies, gespiegeld op de as. De hoek draait het verloop van de basis."""
    width = 64 * v.width
    x = t.axis - (18 + 14 * v.pos) - width / 2  # binnenkant van de streep 4 tot 32 px van de as
    line = [(x, -20), (x, t.h + 20)]
    return [
        fill('l1', v.shade('#22262e'), v.shade('#15181d'), 90 + v.angle),
        paint('l2', 'Lijn 1', [stroke(line, v.shade('#d24b43'), width, t.axis), stroke(line, v.shade('#ffffff'), 6 * v.width, t.axis)]),
    ]


def zonsondergang(t, v):
    """Verloop van oranje naar paars, met een dunne witte horizon die over de zijkanten loopt."""
    width = 12 * v.width
    y = choose(steps(t.h * 0.4, t.h * 0.85, 4), lambda y: balanced(t, chevron(t, y, v.angle), width), v.pick)
    return [
        fill('l1', v.shade('#ff7a18'), v.shade('#7b2ff7'), 90),
        paint('l2', 'Lijn 1', [stroke(chevron(t, y, v.angle), v.shade('#ffffff'), width, t.axis)]),
    ]


def carbon(t, v):
    """Donker verloop met fijne diagonale lijnen."""
    width = 5 * v.width
    lines = parallel_lines(t, 45 + v.angle, 40, 20 * v.pos, width)
    return [
        fill('l1', v.shade('#2b2f36'), v.shade('#15181d'), 45 + v.angle),
        paint('l2', 'Lijn 1', [stroke(line, v.shade('#424955'), width) for line in lines]),
    ]


def blauwe_golven(t, v):
    """Vijf lichtblauwe golven over een diepblauw verloop."""
    strokes = []
    for i in range(5):
        base = t.h * (0.15 + 0.18 * i + 0.04 * v.pos)
        phase = i * 0.9 + math.pi * v.pos2
        pts = [(x, base + 40 * math.sin(2 * math.pi * (x - t.axis) / 400 + phase)) for x in range(-100, t.w + 101, 12)]
        strokes.append(stroke(rotate(pts, v.angle, t.axis, t.h / 2), v.shade('#3da5ff'), 16 * v.width))
    return [fill('l1', v.shade('#0b3d66'), v.shade('#06223b'), 90), paint('l2', 'Lijn 1', strokes)]


def industrieel(t, v):
    """Staalgrijs met een raster (symmetrisch rond de as) en één oranje streep over de zijkanten."""
    grid, width = v.shade('#4b5260'), 7 * v.width
    dy = (v.pos2 + 1) / 2 * 96
    dx = (v.pos + 1) / 2 * 128
    lines = [stroke([(-20, y), (t.w + 20, y)], grid, width) for y in steps(dy, t.h + 1, 96)]
    lines += [stroke([(x, -20), (x, t.h + 20)], grid, width, t.axis) for x in steps(t.axis - dx, -1, -128)]
    stripe = 40 * v.width
    y = choose(steps(t.h * 0.2, t.h * 0.8, 4), lambda y: balanced(t, chevron(t, y, v.angle), stripe), v.pick)
    return [
        fill('l1', v.shade('#8a929c')),
        paint('l2', 'Lijn 1', lines),
        paint('l3', 'Lijn 2', [stroke(chevron(t, y, v.angle), v.shade('#ff8c00'), stripe, t.axis)]),
    ]


def minimaal(t, v):
    """Lichtgrijs met één zwarte lijn over het midden. De hoek draait het verloop van de basis."""
    x = t.axis + 8 * v.pos
    return [
        fill('l1', v.shade('#f2f2f2'), v.shade('#e4e4e4'), 90 + v.angle),
        paint('l2', 'Lijn 1', [stroke([(x, -20), (x, t.h + 20)], v.shade('#111111'), 14 * v.width)]),
    ]


def neon(t, v):
    """Zwart met een cyaan en een magenta zigzag langs de zijkanten, gespiegeld op de as. De hoek is de
    hoek van de tanden (45° ± 8°). Bij de auto's lopen de zigzaggen verticaal over de zijpanelen. Bij de
    Cybertruck liggen de zijkanten boven en onder in het sjabloon; daar lopen ze horizontaal. Het script
    kiest de richting waarin de zigzaggen het meest over de panelen lopen."""
    amp, width = 22, 8 * v.width
    step = 2 * amp / math.tan(math.radians(45 + v.angle))  # afstand tussen twee punten langs de zigzag
    gap = 2 * amp + width + 16  # afstand tussen de cyaan en de magenta zigzag
    top = -20 - (v.pos2 + 1) * step

    def vertical(x):
        return [(x + (amp if i % 2 else -amp), top + i * step) for i in range(int((t.h + 40 - top) / step) + 2)]

    def horizontal(y, sign=1):  # vanaf de as naar links; de editor spiegelt de rechterhelft
        return [(t.axis - i * step, y + sign * (amp if i % 2 else -amp)) for i in range(int((t.axis + 40) / step) + 2)]

    def pairs(kind, p):  # (cyaan, magenta) per zijkant; magenta ligt aan de buitenkant
        if kind == 'vertical':
            return [(vertical(p), vertical(p - gap))]
        return [(horizontal(p), horizontal(p - gap)), (horizontal(t.h - p, -1), horizontal(t.h - p + gap, -1))]

    def score(kind, p):  # deel van de zigzaggen (met spiegeling) dat over de panelen loopt
        lines = [z for pair in pairs(kind, p) for z in pair]
        drawn = sum(2 * math.hypot(b[0] - a[0], b[1] - a[1]) for z in lines for a, b in zip(z, z[1:]))
        return sum(t.visible(z, t.axis, width) for z in lines) / drawn

    candidates = {
        'vertical': steps(gap + amp + 8, t.axis - 150, 4),
        'horizontal': steps(gap + amp + 8, t.h / 2 - amp, 4),
    }
    scores = {kind: {p: score(kind, p) for p in ps} for kind, ps in candidates.items()}
    kind = 'horizontal' if max(scores['horizontal'].values()) > 1.25 * max(scores['vertical'].values()) else 'vertical'
    p = choose(candidates[kind], scores[kind].get, v.pick, keep=0.92)
    cyan, magenta = v.shade('#00e5ff'), v.shade('#ff2bd6')
    strokes = [stroke(z, c, width, t.axis) for pair in pairs(kind, p) for z, c in zip(pair, (cyan, magenta))]
    return [fill('l1', v.shade('#101217')), paint('l2', 'Lijn 1', strokes)]


def waarschuwing(t, v):
    """Zwarte basis met brede gele diagonale strepen."""
    width = 70 * v.width
    lines = parallel_lines(t, 45 + v.angle, 170, 85 * v.pos, width)
    return [fill('l1', v.shade('#111111')), paint('l2', 'Lijn 1', [stroke(line, v.shade('#ffd400'), width) for line in lines])]


def stippen(t, v):
    """Donkergrijs met een raster van kleine witte stippen. De hoek draait het raster."""
    spacing, size = 30, 9 * v.width
    cx, cy = t.axis + v.pos * spacing / 2, t.h / 2 + v.pos2 * spacing / 2
    n = int(t.reach(cx, cy) / spacing) + 1
    grid = [(cx + i * spacing, cy + j * spacing) for j in range(-n, n + 1) for i in range(-n, n + 1)]
    dots = [stroke([p], v.shade('#ffffff'), size) for p in rotate(grid, v.angle, cx, cy) if t.touches(p[0], p[1], size / 2)]
    return [fill('l1', v.shade('#272b32')), paint('l2', 'Lijn 1', dots)]


def cirkels(t, v):
    """Antraciet met concentrische rode ringen rond het midden. De hoek draait het verloop van de basis."""
    spacing, width = 60, 14 * v.width
    cx, cy = t.axis, t.h / 2 + 0.04 * t.h * v.pos
    rings = []
    for r in steps(30 + (v.pos2 + 1) / 2 * spacing, t.reach(cx, cy) + width, spacing):
        n = max(48, round(2 * math.pi * r / 12))
        pts = [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n + 1)]
        if t.visible(pts) >= 40:  # ringen die niet over een paneel lopen, laten we weg
            rings.append(stroke(pts, v.shade('#e0393e'), width))
    return [fill('l1', v.shade('#3a4045'), v.shade('#2b3034'), 90 + v.angle), paint('l2', 'Lijn 1', rings)]


# Nummer, naam en beschrijving (de naam en de beschrijving zijn sleutels in js/i18n/<taal>.json), de bouwer,
# en de twee parameters van Variation die je in deze familie het best ziet.
Family = collections.namedtuple('Family', 'nn name description build visible')
FAMILIES = [
    Family(1, 'Rode lijnen', 'Donkergrijs met twee rode racestrepen over het midden.', rode_lijnen, ('pos', 'width')),
    Family(2, 'Zonsondergang', 'Een verloop van oranje naar paars met een witte horizon.', zonsondergang, ('pick', 'angle')),
    Family(3, 'Carbon', 'Een donker verloop met fijne diagonale lijnen.', carbon, ('angle', 'pos')),
    Family(4, 'Blauwe golven', 'Lichtblauwe golven over een diepblauwe basis.', blauwe_golven, ('pos', 'pos2')),
    Family(5, 'Industrieel', 'Staalgrijs met een raster en één oranje streep.', industrieel, ('pick', 'pos')),
    Family(6, 'Minimaal', 'Lichtgrijs met één zwarte lijn over het midden.', minimaal, ('pos', 'width')),
    Family(7, 'Neon', 'Zwart met een cyaan en een magenta zigzag langs de zijkanten.', neon, ('angle', 'pick')),
    Family(8, 'Waarschuwing', 'Zwarte basis met gele diagonale strepen.', waarschuwing, ('pos', 'angle')),
    Family(9, 'Stippen', 'Donkergrijs met een raster van witte stippen.', stippen, ('angle', 'pos')),
    Family(10, 'Cirkels', 'Antraciet met concentrische cirkels in rood.', cirkels, ('pos2', 'pos')),
]

_VARIATIONS = {}


def variation(model_id, nn):
    """De vaste variatie van een ontwerp. Per familie en per auto (groep) gaan de modellen in de volgorde
    van assets/templates/index.json. Ligt een variant in beide zichtbare parameters minder dan SPREAD van
    het bereik bij een eerdere variant van dezelfde auto, dan krijgt hij de volgende seed."""
    if not _VARIATIONS:
        for family in FAMILIES:
            for group in dict.fromkeys(m['group'] for m in MODELS):
                earlier = []
                for m in (m for m in MODELS if m['group'] == group):
                    v = next(
                        v for v in (Variation(m['id'], family.nn, salt) for salt in range(1000))
                        if all(v.distance(w, family.visible) >= SPREAD for w in earlier)
                    )
                    earlier.append(v)
                    _VARIATIONS[(m['id'], family.nn)] = v
    return _VARIATIONS[(model_id, nn)]


# --- index, projecten en miniaturen ----------------------------------------------------------------


def ordered_models():
    """De modellen per groep (in de volgorde waarin de groepen voorkomen), en binnen een groep in de
    volgorde van assets/templates/index.json."""
    groups = list(dict.fromkeys(m['group'] for m in MODELS))
    return [m for g in groups for m in MODELS if m['group'] == g]


def example_id(model, family):
    return f"{model['id']}-{family.nn:02d}"


def build_index():
    """De lijst voor de galerij: groep, dan model, dan nummer."""
    index = []
    for m in ordered_models():
        for f in FAMILIES:
            ex_id = example_id(m, f)
            index.append({
                'id': ex_id,
                'name': f.name,
                'description': f.description,
                'model': m['id'],
                'modelName': m['name'],
                'group': m['group'],
                'code': m['code'],
                'download': f"wrap_{m['code']}_{f.nn:02d}.png",
                'image': f'voorbeelden/{ex_id}.png',
                'thumb': f'voorbeelden/{ex_id}-512.png',
            })
    return index


def build_project(model, family):
    """Het projectbestand van één ontwerp, zoals "Project opslaan" in de editor het maakt."""
    layers = family.build(template(model['id']), variation(model['id'], family.nn))
    return {'format': 'tesla-wrap-project', 'version': 2, 'name': family.name, 'model': model['id'], 'layers': layers, 'assets': {}}


def write_projects():
    OUT.mkdir(exist_ok=True)
    for m in ordered_models():
        for f in FAMILIES:
            project = build_project(m, f)
            (OUT / f'{example_id(m, f)}.json').write_text(json.dumps(project, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    index = build_index()
    (OUT / 'index.json').write_text(json.dumps({'examples': index}, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'{len(index)} projecten en index.json geschreven naar {OUT.relative_to(ROOT)}/')


def load_index():
    return json.loads((OUT / 'index.json').read_text(encoding='utf8'))['examples']


def make_thumbs():
    """Miniatuur van 512 px breed uit elke geëxporteerde PNG (Lanczos)."""
    index = load_index()
    for ex in index:
        with Image.open(ROOT / ex['image']) as im:
            im = im.convert('RGB')
            im.resize((THUMB_WIDTH, round(THUMB_WIDTH * im.height / im.width)), Image.LANCZOS).save(ROOT / ex['thumb'], optimize=True)
    print(f'{len(index)} miniaturen gemaakt')


# --- controles ---------------------------------------------------------------------------------------


def check():
    """Controleert de bestanden van alle voorbeelden. Geeft True als alles klopt."""
    index = load_index()
    errors = []
    hashes = {}
    small = {}
    for ex in index:
        t = template(ex['model'])
        name = ex['download']
        if not TESLA_NAME.fullmatch(name) or len(name) > TESLA_MAX:
            errors.append(f"{ex['id']}: downloadnaam {name!r} voldoet niet aan de Tesla-eis")
        project_path = OUT / f"{ex['id']}.json"
        if not project_path.exists():
            errors.append(f"{ex['id']}: projectbestand ontbreekt")
        else:
            project = json.loads(project_path.read_text(encoding='utf8'))
            if (project.get('format'), project.get('version'), project.get('model'), project.get('name')) != (
                'tesla-wrap-project', 2, ex['model'], ex['name']):
                errors.append(f"{ex['id']}: projectbestand hoort niet bij de index")
        image = ROOT / ex['image']
        if not image.exists():
            errors.append(f"{ex['id']}: {ex['image']} ontbreekt")
            continue
        if image.stat().st_size > MAX_BYTES:
            errors.append(f"{ex['id']}: PNG is {image.stat().st_size} bytes, meer dan 1 MB")
        with Image.open(image) as im:
            if im.size != (t.w, t.h):
                errors.append(f"{ex['id']}: PNG is {im.size[0]} × {im.size[1]}, sjabloon is {t.w} × {t.h}")
                continue
            rgb = im.convert('RGB')
        outside = t.mask.point(lambda v: 255 if v == 0 else 0)
        if any(ImageChops.multiply(band, outside).getextrema()[1] for band in rgb.split()):
            errors.append(f"{ex['id']}: niet zwart buiten de panelen")
        digest = hashlib.sha256(rgb.tobytes()).hexdigest()
        if digest in hashes:
            errors.append(f"{ex['id']}: zelfde pixels als {hashes[digest]}")
        hashes.setdefault(digest, ex['id'])
        small[ex['id']] = rgb.resize((96, round(96 * t.h / t.w)), Image.BOX)
        thumb = ROOT / ex['thumb']
        if not thumb.exists():
            errors.append(f"{ex['id']}: {ex['thumb']} ontbreekt")
        else:
            with Image.open(thumb) as th:
                if th.size != (THUMB_WIDTH, round(THUMB_WIDTH * t.h / t.w)):
                    errors.append(f"{ex['id']}: miniatuur is {th.size[0]} × {th.size[1]}")
    names = [ex['download'] for ex in index]
    if len(set(names)) != len(names):
        errors.append('downloadnamen zijn niet uniek')
    expected = {'index.json'} | {pathlib.Path(p).name for ex in index for p in (ex['image'], ex['thumb'], f"{ex['id']}.json")}
    extra = sorted(p.name for p in OUT.iterdir() if p.name not in expected)
    if extra:
        errors.append(f"bestanden in voorbeelden/ die niet in de index staan: {', '.join(extra)}")

    # Hoe dicht liggen de ontwerpen bij elkaar? Gemiddeld verschil per pixel (0-255) op 96 px breed.
    def diff(a, b):
        return sum(ImageStat.Stat(ImageChops.difference(small[a], small[b])).mean) / 3

    ids = list(small)
    within, across = [], []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if small[a].size != small[b].size:
                continue
            same_model = a.rsplit('-', 1)[0] == b.rsplit('-', 1)[0]
            (within if same_model else across).append((diff(a, b), a, b))

    print(f'{len(index)} voorbeelden, {len(hashes)} verschillende PNG\'s')
    print(f'langste downloadnaam: {max(names, key=len)} ({max(map(len, names))} tekens)')
    if within:
        d, a, b = min(within)
        print(f'kleinste verschil binnen één model: {d:.1f} ({a} en {b})')
    if across:
        for d, a, b in sorted(across)[:3]:
            print(f'kleinste verschil tussen modellen: {d:.1f} ({a} en {b})')
    for e in errors:
        print('FOUT:', e)
    print('alles in orde' if not errors else f'{len(errors)} fouten')
    return not errors


def main():
    args = sys.argv[1:]
    if '--thumbs' in args:
        make_thumbs()
        sys.exit(0 if check() else 1)
    if '--check' in args:
        sys.exit(0 if check() else 1)
    write_projects()


if __name__ == '__main__':
    main()
