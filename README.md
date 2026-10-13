# Tesla Wrap Ontwerper

Ontwerp je eigen Tesla-wrap in de browser en download hem als PNG, klaar voor de Tesla-app.

- De startpagina staat op `/`, met de galerij van voorbeelden.
- De editor staat op `/ontwerp/`.

Plan en keuzes staan in [PLAN.md](PLAN.md). Ideeën voor later staan in [IDEEN.md](IDEEN.md).

## Gebruik

Op de startpagina van de editor zie je **Mijn ontwerpen**: al je ontwerpen, met een miniatuur. Per ontwerp kun je het **openen**, **dupliceren**, **hernoemen** of **verwijderen**. Daaronder kies je een **model** voor een nieuw ontwerp.

De editor heeft drie stappen, bovenaan de pagina:

1. **Model**: kies je Tesla-model. Dat maakt een nieuw ontwerp; je vorige ontwerp blijft in je lijst staan.
2. **Ontwerpen**: klik op een paneel om het te kiezen, en teken, vul of voeg een foto, sticker of tekst toe. Lagen en eigenschappen staan rechts.
3. **Exporteren**: de controles (formaat, zwart tussen de panelen, bestandsgrootte) moeten groen zijn. Download daarna de PNG.

Elk ontwerp wordt automatisch bewaard in de browser (IndexedDB). Op een ander apparaat of in een andere browser zie je je ontwerpen niet. Accounts komen later (zie [IDEEN.md](IDEEN.md)).

### Voorbeelden uit de galerij

Op de startpagina staan voorbeelden met een filter per model. Met **Openen en aanpassen** krijg je een eigen kopie in je lijst met ontwerpen; het voorbeeld zelf verandert niet.

### Foto's

Waar een foto komt, hangt af van de gekozen panelen:

- **Geen paneel gekozen**: de foto komt op de hele wrap.
- **Één paneel gekozen**: de foto komt op dat paneel.
- **Meerdere panelen gekozen**: de knop *Foto over N panelen* legt één foto over alle gekozen panelen. Met *Eén foto per paneel* krijgt elk paneel een eigen foto: kies één bestand (dan voor alle panelen), of precies zoveel bestanden als er panelen zijn, in paneelvolgorde.

Op de telefoon staat *Foto* in de werkbalk onderaan. Daaronder staat waar de foto komt: hele wrap of paneel.

### Bediening

- **Zoomen**: met de knoppen rechtsonder het canvas, het scrollwiel, of "Naar gekozen paneel". Op de telefoon tekent één vinger, en twee vingers knijpen en verschuiven.
- **Symmetrie**: zet je het aan, dan worden het gekozen paneel en het spiegelpaneel samen gekozen, en wordt een tekening aan beide kanten getekend.
- **Foto's verplaatsen en draaien**: sleep een gekozen foto (met Selecteer of Verplaats) om te verschuiven. Een hoekje vergroot, het bolletje boven de foto draait. Pijltjes verschuiven (met Shift 10 px), `[` en `]` draaien 5°. Op de telefoon verschuift één vinger; draaien en knijpen doe je met twee vingers, met Verplaats.
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

Ga daarna naar http://localhost:8000 (startpagina) of http://localhost:8000/ontwerp/ (editor).

## Structuur

- `index.html`, `css/landing.css`, `js/landing.js`: de startpagina met galerij, hoe het werkt en voordelen.
- `ontwerp/index.html`, `css/style.css`: de editor, met de stappen en de lijst met ontwerpen.
- `js/app.js`: stappen, ontwerpen, gereedschap, zoomen, symmetrie, lagen, project, sneltoetsen en de exportdialoog.
- `js/store.js`: ontwerpen in IndexedDB (de lijst en de inhoud).
- `js/render.js`: tekent de lagen. Dezelfde code levert het voorbeeld en de export.
- `js/template.js`: laadt het paneel-masker, zoekt het paneel onder de aanwijzer en tekent de omlijning.
- `js/export.js`: PNG-export met controles, en een palet-PNG als het bestand boven 1 MB komt.
- `js/model.js`, `js/util.js`: geschiedenis (ongedaan maken) en hulpfuncties.
- `assets/templates/index.json`: lijst met modellen en groepen.
- `assets/templates/<model>/`: paneel-masker (`mask.png`) en paneelgegevens (`panels.json`): naam, spiegelas en spiegelpaneel per paneel.
- `voorbeelden/`: de voorbeeldontwerpen voor de galerij. `index.json` is de lijst, `<id>.json` het projectbestand, `<id>.png` de afbeelding (1024 px) en `<id>-512.png` de miniatuur.
- `scripts/build_examples.py`: maakt de projectbestanden van de voorbeelden.
- `scripts/build_template.py`: maakt een masker uit een sjabloonafbeelding.

## Voorbeeld toevoegen

1. Voeg een voorbeeld toe aan `EXAMPLES` in `scripts/build_examples.py` en draai `python3 scripts/build_examples.py`. Dat schrijft `voorbeelden/<id>.json` en de lijst `voorbeelden/index.json`.
2. Maak de afbeeldingen: open `/ontwerp/`, kies *Project openen* en kies `voorbeelden/<id>.json`. Exporteer de PNG en sla hem op als `voorbeelden/<id>.png`. Maak daarna een miniatuur van 512 px breed als `voorbeelden/<id>-512.png`.

Een voorbeeld dat in de editor is geëxporteerd, is pixel voor pixel gelijk aan wat de galerij toont.

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

Een project (JSON) bevat het model, de naam, alle lagen, foto's en stickers. Openen maakt een nieuw ontwerp in je lijst; je huidige ontwerp blijft staan.

## Hosten

De site heeft geen build-stap. Zet de map op een statische host, zoals Vercel of GitHub Pages. De startpagina is `/`, de editor is `/ontwerp/`.

Voor Vercel: Framework Preset "Other", geen build-commando, Output Directory `.`.
