# Tesla Wrap Ontwerper

Ontwerp je eigen Tesla-wrap in de browser en download hem als PNG, klaar voor de Tesla-app.

Het ontwerp en de keuzes staan in [PLAN.md](PLAN.md).

## Modellen

Kies bovenaan je model. De sjablonen komen uit de officiële Tesla-repo [teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps). In deze repo staan alleen de paneel-maskers (`assets/templates/<model>/`), niet de sjabloonafbeeldingen zelf.

- Cybertruck: 1024 × 768 px (de afmeting van Tesla's sjabloon)
- Alle andere Tesla-modellen: 1024 × 1024 px
- Voyager: een eigen sjabloon, 1024 × 1024 px

De export gebruikt altijd de afmeting van het gekozen sjabloon.

## Draaien

De site gebruikt ES-modules, dus open hem via een webserver:

    python3 -m http.server 8000

Ga daarna naar http://localhost:8000.

## Structuur

- `index.html`, `css/style.css`: interface, responsief voor pc en telefoon
- `js/app.js`: modelkeuze, gereedschap, lagen, project en export
- `js/render.js`: tekent de lagen. Dezelfde code levert het voorbeeld en de export.
- `js/template.js`: laadt het paneel-masker, hit-test en paneelomlijning
- `js/export.js`: PNG-export met controles, en een palet-PNG als het bestand boven 1 MB komt
- `js/model.js`, `js/util.js`: geschiedenis (ongedaan maken) en hulpfuncties
- `assets/templates/index.json`: lijst met modellen
- `assets/templates/<model>/`: paneel-masker (`mask.png`) en paneelnamen (`panels.json`)
- `scripts/build_template.py`: maakt een masker uit een sjabloonafbeelding

## Sjabloon toevoegen of vernieuwen

    python3 scripts/build_template.py sjabloon.png assets/templates/<id> --name "<naam>" --preview preview.png

Tesla-sjablonen: gebruik de standaardwaarden. Voor een donkere render zonder alpha (zoals Voyager): `--size 1024 1024 --threshold 8 --fill-holes`.
Controleer `preview.png`: elk paneel krijgt een eigen kleur. Voeg daarna een regel toe aan `assets/templates/index.json`.

## Export

- PNG op de afmeting van het sjabloon, zwart buiten de panelen, maximaal 1 MB. Bij een groter bestand worden de kleuren teruggebracht tot een palet-PNG.
- Bestandsnaam: `wrap_<code>_<uurminuut>.png`. Dat voldoet aan de Tesla-eis: letters, cijfers, `-` en `_`, maximaal 30 tekens.
- Upload in de Tesla-app (vanaf versie 4.59.0): Creations → Wrap → Upload.

## Hosten

De site heeft geen build-stap. Zet de map op een statische host, zoals Vercel of GitHub Pages.
