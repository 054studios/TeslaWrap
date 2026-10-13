#!/usr/bin/env python3
"""Controleert de vertalingen in js/i18n/*.json.

De Nederlandse tekst is de sleutel. Het script verzamelt alle zichtbare Nederlandse teksten:
de t()-aanroepen in de JavaScript, de tekst en attributen van de HTML, en de namen in de
model- en voorbeeldlijsten. Per taal meldt het wat ontbreekt, wat overbodig is en welke
{variabelen} niet kloppen.

  python3 scripts/check_i18n.py          controleren; geeft een fout bij ontbrekende vertalingen
  python3 scripts/check_i18n.py --keys   alle sleutels als JSON, voor de vertalers
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_FILES = ['index.html', 'ontwerp/index.html']
TEXT_ATTRS = {'aria-label', 'title', 'alt', 'placeholder'}
# Teksten zonder vertaling: de merknaam en eenheden.
IGNORE = {'Tesla Wrap', 'px', 'teslamotors/custom-wraps'}
# Teksten die als waarde van een constante of variabele naar t() gaan (LABELS, TOOL_HINTS, HINT_*),
# en daarom niet als letterlijke t('...')-aanroep in de code staan. Het script controleert dat ze
# in de JavaScript voorkomen, zodat deze lijst niet ongemerkt verouderd.
DYNAMIC = [
    'Kleurvlak', 'Foto', 'Sticker', 'Tekening', 'Tekst', 'Voorbeeld', 'Alle',
    'Tweede kleur', 'Hoek', 'Vergroting', 'Draaien', 'Dekking', 'Grootte',
    'Tik op een paneel om het te kiezen. Met Meerdere panelen of Shift kies je er meer.',
    'Sleep een foto, sticker of tekst. Op een leeg deel van het canvas verschuif je het beeld.',
    'Teken met één vinger. Met twee vingers zoom je of verschuif je het beeld.',
    'De gum wist op de geselecteerde tekenlaag.',
    'Tik op de wrap om een tekstlaag te plaatsen.',
    'Sleep de foto om te verschuiven.',
    'Sleep de sticker om te verschuiven.',
    'Sleep de tekst om te verschuiven.',
]
# i18n.js noemt t() in commentaar als voorbeeld; dat is geen sleutel.
JS_SKIP = {'i18n.js'}
JS_CALL = re.compile(r"""\bt\(\s*(['"])((?:\\.|(?!\1).)*?)\1""")
PLACEHOLDER = re.compile(r'\{\w+\}')


class HtmlTexts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.keys = set()
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.hidden += 1
        values = dict(attrs)
        for name, value in attrs:
            if not value:
                continue
            is_description = tag == 'meta' and name == 'content' and values.get('name') == 'description'
            if name in TEXT_ATTRS or is_description:
                self.keys.add(value.strip())

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden and data.strip():
            self.keys.add(data.strip())


def js_keys():
    keys = set()
    sources = ''
    for path in (ROOT / 'js').rglob('*.js'):
        sources += path.read_text(encoding='utf-8')
        if path.name in JS_SKIP:
            continue
        for _, key in JS_CALL.findall(path.read_text(encoding='utf-8')):
            keys.add(key)
    for key in DYNAMIC:
        if f"'{key}'" not in sources:
            sys.exit(f'DYNAMIC-sleutel komt niet voor in de JavaScript: {key!r}')
        keys.add(key)
    return keys


def html_keys():
    keys = set()
    for rel in HTML_FILES:
        parser = HtmlTexts()
        parser.feed((ROOT / rel).read_text(encoding='utf-8'))
        keys |= parser.keys
    return keys


def data_keys():
    keys = set()
    for m in json.loads((ROOT / 'assets/templates/index.json').read_text(encoding='utf-8'))['models']:
        keys.add(m['name'])
    for ex in json.loads((ROOT / 'voorbeelden/index.json').read_text(encoding='utf-8'))['examples']:
        keys.update([ex['name'], ex['description'], ex['modelName']])
    for path in (ROOT / 'voorbeelden').glob('*.json'):
        if path.name != 'index.json':
            name = json.loads(path.read_text(encoding='utf-8')).get('name')
            if name:
                keys.add(name)
    return keys


def source_keys():
    keys = js_keys() | html_keys() | data_keys()
    return sorted(k for k in keys if re.search(r'[^\W\d_]', k) and k not in IGNORE)


def check(keys):
    failed = False
    for path in sorted((ROOT / 'js/i18n').glob('*.json')):
        lang = path.stem
        data = json.loads(path.read_text(encoding='utf-8'))
        missing = [k for k in keys if not str(data.get(k, '')).strip()]
        unused = [k for k in data if k not in keys]
        wrong = [
            k for k in keys
            if k in data and sorted(PLACEHOLDER.findall(k)) != sorted(PLACEHOLDER.findall(data[k]))
        ]
        print(f'{lang}: {len(keys) - len(missing)}/{len(keys)} vertaald, {len(unused)} overbodig')
        for label, items in (('ontbreekt', missing), ('variabelen kloppen niet', wrong), ('overbodig', unused)):
            for k in items:
                print(f'  {label}: {k}')
        failed = failed or bool(missing or wrong)
    return failed


if __name__ == '__main__':
    keys = source_keys()
    if '--keys' in sys.argv:
        print(json.dumps(keys, ensure_ascii=False, indent=2))
    else:
        sys.exit(1 if check(keys) else 0)
