# Tesla Wrap Ontwerper

Ontwerp je eigen Tesla-wrap in de browser en download hem als PNG, klaar voor de Tesla-app.

Plan en keuzes staan in [PLAN.md](PLAN.md). Ideeën voor later staan in [IDEEN.md](IDEEN.md).

## Gebruik

De editor heeft drie stappen, bovenaan de pagina:

1. **Model**: kies je Tesla-model uit twaalf sjablonen. Bij wisselen wordt het ontwerp gewist, na bevestiging.
2. **Ontwerpen**: klik op een paneel om het te kiezen, en teken, vul of voeg een foto, sticker of tekst toe. Lagen en eigenschappen staan rechts.
3. **Exporteren**: de controles (formaat, zwart tussen de panelen, bestandsgrootte) moeten groen zijn. Download daarna de PNG.

Het ontwerp wordt automatisch bewaard in dezelfde browser. Kom je later terug, dan kun je doorgaan waar je was.

### Foto's

Waar een foto komt, hangt af van de gekozen panelen:

- **Geen paneel gekozen**: de foto komt op de hele wrap.
- **Één paneel gekozen**: de foto komt op dat paneel.
- **Meerdere panelen gekozen**: de knop *Foto over N panelen* legt één foto over alle gekozen panelen. Met *Eén foto per paneel* krijgt elk paneel een eigen foto: kies één bestand (dan voor alle panelen), of precies zoveel bestanden als er panelen zijn, in paneelvolgorde.

Op de telefoon staat *Foto* in de werkbalk onderaan. Daaronder staat waar de foto komt: hele wrap of paneel.

### Bediening

- **Zoomen**: met de knoppen rechtsonder het canvas, het scrollwiel, of "Naar gekozen paneel". Op de telefoon tekent één vinger, en twee vingers knijpen en verschuiven.
- **Symmetrie**: zet je het aan, dan worden het gekozen paneel en het spiegelpaneel samen gekozen, en wordt een tekening aan beide kanten getekend.
- **Sneltoetsen (pc)**: `S` selecteren, `V` verplaatsen, `B` kwast, `E` gum, `T` tekst. `Ctrl+Z` ongedaan maken, `Ctrl+Y` opnieuw. Houd `Spatie` ingedrukt om te verschuiven. `+` en `-` zoomen, `0` past de wrap in beeld. `Delete` verwijdert de gekozen laag.

## Modellen

De twaalf sjablonen komen uit de officiële Tesla-repo [teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps). Deze repo bevat alleen de paneel-maskers (`assets/templates/<model>/`), niet de sjabloonafbeeldingen zelf.

- Cybertruck: 1024 × 768 px, de afmeting van Tesla's sjabloon.
- Alle andere modellen: 1024 × 1024 px.
- Symmetrie werkt voor alle panelen, behalve drie bij Model X (2021+) en één bij de Cybertruck. Die hebben geen spiegelpaneel.

De export gebruikt altijd de afmeting van het gekozen sjabloon.

## Draaien

De site gebruikt ES-modules, dus open hem via een webserver:

    python3 -m http.server 8000

Ga daarna naar http://localhost:8000.

## Structuur

- `index.html`, `css/style.css`: de drie stappen, de editor en de layout. Responsief voor pc en telefoon.
- `js/app.js`: stappen, gereedschap, zoomen, symmetrie, lagen, project, sneltoetsen en de exportdialoog.
- `js/render.js`: tekent de lagen. Dezelfde code levert het voorbeeld en de export.
- `js/template.js`: laadt het paneel-masker, zoekt het paneel onder de aanwijzer en tekent de omlijning.
- `js/store.js`: automatisch opslaan in IndexedDB.
- `js/export.js`: PNG-export met controles, en een palet-PNG als het bestand boven 1 MB komt.
- `js/model.js`, `js/util.js`: geschiedenis (ongedaan maken) en hulpfuncties.
- `assets/templates/index.json`: lijst met modellen en groepen.
- `assets/templates/<model>/`: paneel-masker (`mask.png`) en paneelgegevens (`panels.json`): naam, spiegelas en spiegelpaneel per paneel.
- `scripts/build_template.py`: maakt een masker uit een sjabloonafbeelding.

## Sjabloon toevoegen of vernieuwen

Het script heeft `numpy` en `Pillow` nodig (`pip install numpy pillow`).

    python3 scripts/build_template.py sjabloon.png assets/templates/<id> --name "<naam>" --preview preview.png

- `--size W H`: schaal het sjabloon eerst naar deze afmeting. Standaard blijft de eigen afmeting.
- `--threshold N`: een pixel is beschrijfbaar bij een luminantie boven N en een alpha van minstens 128. Standaard 128.
- `--fill-holes`: donkere gebieden die volledig binnen een paneel liggen, tellen ook als paneel.
- `--min-area N`: kleinere gebieden zijn ruis. Standaard 300 px.
- `--preview PAD.png`: toont de herkende panelen in kleur. Controleer dit bestand: elk paneel moet een eigen kleur hebben.

Voeg daarna een regel toe aan `assets/templates/index.json`.

## Export

- PNG op de afmeting van het sjabloon, zwart tussen en rond de panelen, geen witte rand. De PNG is volledig ondoorzichtig.
- Maximaal 1 MB. Is het bestand groter, dan worden de kleuren teruggebracht tot een palet-PNG die past.
- Bestandsnaam: `wrap_<code>_<uurminuut>.png`, bijvoorbeeld `wrap_m3-24-std_0753.png`. Dat voldoet aan de Tesla-eis: letters, cijfers, `-` en `_`, maximaal 30 tekens.
- Upload in de Tesla-app (vanaf versie 4.59.0): Creations → Wrap → Upload.

## Project

Een project (JSON) bevat het model, alle lagen, foto's en stickers. Openen zet het model terug. Heb je al werk op het canvas, dan vraagt de app eerst om bevestiging.

## Hosten

De site heeft geen build-stap. Zet de map op een statische host, zoals Vercel of GitHub Pages.

Voor Vercel: Framework Preset "Other", geen build-commando, Output Directory `.`.
