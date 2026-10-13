# Tesla Wrap Ontwerper

Ontwerp je eigen Tesla-wrap in de browser en download hem als PNG, klaar voor de Tesla-app.

- De startpagina staat op `/`: kies een model, bekijk de voorbeelden en download ze als PNG.
- De editor staat op `/ontwerp/`.

Plan en keuzes staan in [PLAN.md](PLAN.md). Ideeën voor later staan in [IDEEN.md](IDEEN.md).

## Gebruik

Op de startpagina van de editor zie je **Mijn ontwerpen**: al je ontwerpen, met een miniatuur. Per ontwerp kun je het **openen**, **dupliceren**, **hernoemen** of **verwijderen**. Daaronder kies je een **model** voor een nieuw ontwerp.

De editor heeft drie stappen, bovenaan de pagina:

1. **Model**: kies je Tesla-model. Dat maakt een nieuw ontwerp; je vorige ontwerp blijft in je lijst staan.
2. **Ontwerpen**: klik op een paneel om het te kiezen, en teken, vul of voeg een foto, sticker of tekst toe. Lagen en eigenschappen staan rechts.
3. **Exporteren**: de controles (formaat, zwart tussen de panelen, bestandsgrootte) moeten groen zijn. Download daarna de PNG.

Elk ontwerp wordt automatisch bewaard in de browser (IndexedDB). Op een ander apparaat of in een andere browser zie je je ontwerpen niet. Accounts komen later (zie [IDEEN.md](IDEEN.md)).

### Voorbeelden en downloads

De startpagina begint met de autokeuze: kies een van de twaalf modellen, en je gaat meteen naar de editor met dat model klaar. Daaronder staat de galerij. Per auto kies je een model en zie je tien ontwerpen.

Met **Download PNG** download je een ontwerp als bestand voor de Tesla-app: 1024 × 1024 px, of 1024 × 768 px voor de Cybertruck, onder de 1 MB. De bestandsnaam is `wrap_<code>_<nn>.png`. Met **Openen en aanpassen** krijg je een eigen kopie in je lijst met ontwerpen; het voorbeeld zelf verandert niet.

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

## Talen

De site is er in vijf talen: Nederlands, English, Deutsch, Français en Türkçe. Met de kiezer rechtsboven in de kop wissel je van taal, op de startpagina en in de editor.

Bij het eerste bezoek kiest de site de taal in deze volgorde:

1. je eigen keuze, als je die eerder hebt gemaakt;
2. het land van de bezoeker (Nederland, Duitsland, Oostenrijk, Frankrijk of Turkije; andere landen gaan naar stap 3). Dat komt van Vercel en werkt dus pas online, niet lokaal;
3. de taal van de browser, als de site die kent;
4. anders Engels.

Je keuzes onthoudt de site in de browser: de taal, het gereedschap, kleur en dikte, symmetrie, meerdere panelen, paneellijnen, paneelnummers en het galerijfilter.

Vertalingen staan in `js/i18n/<taal>.json`. De Nederlandse tekst is de sleutel: `"Galerij": "Gallery"`. Een tekst zonder vertaling blijft Nederlands. Variabelen zoals `{n}` of `{name}` blijven in de vertaling staan. Een nieuwe taal voeg je toe met een `.json`-bestand en een regel in `LANGS` in `js/i18n.js`. Controleer de vertalingen met:

    python3 scripts/check_i18n.py

De vertalingen zijn door AI gemaakt en nog niet door moedertaalsprekers nagelezen. De Tesla-menunamen (Creations, Wrap, Upload) blijven in het Engels, omdat de Tesla-app die namen per taal anders kan noemen.

## Draaien

De site gebruikt ES-modules, dus open hem via een webserver:

    python3 -m http.server 8000

Ga daarna naar http://localhost:8000 (startpagina) of http://localhost:8000/ontwerp/ (editor).

## Structuur

- `index.html`, `css/landing.css`, `js/landing.js`: de startpagina met de autokeuze, de galerij, hoe het werkt, voordelen en vragen.
- `DESIGN.md`: de visuele beslissingen voor de startpagina, met de bron van elke regel.
- `fonts/`: Geist en Geist Mono, zelf gehost. Licentie: `fonts/LICENSE-Geist.txt` (SIL Open Font License).
- `ontwerp/index.html`, `css/style.css`: de editor, met de stappen en de lijst met ontwerpen.
- `js/app.js`: stappen, ontwerpen, gereedschap, zoomen, symmetrie, lagen, project, sneltoetsen en de exportdialoog.
- `js/store.js`: ontwerpen in IndexedDB (de lijst en de inhoud).
- `js/i18n.js`: de talen, de taalkeuze en de vertaalfunctie `t()`. De vertalingen staan in `js/i18n/<taal>.json`.
- `js/prefs.js`: onthoudt je keuzes (taal, gereedschap, kleur, paneel-opties, galerijfilter) in de browser.
- `api/country.js`: geeft het land van de bezoeker terug, voor de taal bij het eerste bezoek (Vercel).
- `scripts/check_i18n.py`: controleert of elke tekst in elke taal vertaald is.
- `js/render.js`: tekent de lagen. Dezelfde code levert het voorbeeld en de export.
- `js/template.js`: laadt het paneel-masker, zoekt het paneel onder de aanwijzer en tekent de omlijning.
- `js/export.js`: PNG-export met controles, en een palet-PNG als het bestand boven 1 MB komt.
- `js/model.js`, `js/util.js`: geschiedenis (ongedaan maken) en hulpfuncties.
- `assets/templates/index.json`: lijst met modellen en groepen.
- `assets/templates/<model>/`: paneel-masker (`mask.png`) en paneelgegevens (`panels.json`): naam, spiegelas en spiegelpaneel per paneel.
- `voorbeelden/`: de voorbeeldontwerpen voor de galerij, tien per model. `index.json` is de lijst, `<id>.json` het projectbestand (`<id>` is `<model>-<nn>`), `<id>.png` de Tesla-klare PNG op sjabloonformaat en `<id>-512.png` de miniatuur.
- `scripts/build_examples.py`: maakt de 120 voorbeeldontwerpen (tien per model), de lijst en de miniaturen.
- `scripts/render_examples.js`: exporteert de voorbeelden met de editor zelf, zodat elke PNG precies is wat de editor exporteert.
- `scripts/build_template.py`: maakt een masker uit een sjabloonafbeelding.

## Voorbeelden maken en vernieuwen

De tien ontwerpfamilies staan in `scripts/build_examples.py` (`FAMILIES`). Elk ontwerp heeft een vaste seed, zodat dezelfde invoer altijd dezelfde ontwerpen geeft. Vanuit de repo-root (het script heeft Pillow nodig: `pip install pillow`):

1. `python3 scripts/build_examples.py`: maakt de projectbestanden `voorbeelden/<model>-<nn>.json` en de lijst `voorbeelden/index.json`.
2. Start de server (`python3 -m http.server 8000 --bind 127.0.0.1`) en render de PNG's met de editor: `NODE_PATH=$(npm root -g) node scripts/render_examples.js`. Je kunt er id's achter zetten om alleen die te maken.
3. `python3 scripts/build_examples.py --thumbs`: maakt de miniaturen van 512 px en draait daarna de controles.
4. `python3 scripts/build_examples.py --check`: alleen de controles (afmeting, bestandsgrootte, downloadnamen en dat geen twee ontwerpen gelijk zijn).

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

De map `api/` bevat één serverless functie, `api/country.js`, die het land van de bezoeker teruggeeft. Vercel draait die vanzelf. Op een andere host werkt de site ook, maar dan kiest hij de taal van de browser.

Voor Vercel: Framework Preset "Other", geen build-commando, Output Directory `.`.
