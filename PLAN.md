# Tesla Wrap Ontwerper: plan

## Doel

Een website waarop je zelf een Tesla-wrap ontwerpt en die downloadt als PNG, klaar om te uploaden in de Tesla-app.

## Eisen uit het sjabloon

- PNG op de afmeting van het gekozen Tesla-sjabloon (1024 × 1024; Cybertruck 1024 × 768), maximaal 1 MB.
- Zwarte achtergrond tussen en rond de panelen, geen witte rand.
- Paneelvormen en -afmetingen van het sjabloon behouden.
- Artwork volledig binnen de panelen.

## Keuzes

- **Statische site** (HTML, CSS, JavaScript), zonder build-stap en zonder externe libraries.
- **Alles in de browser.** Foto's verlaten het apparaat niet. Het ontwerp wordt bewaard in de browser (IndexedDB), zodat het na herladen terugkomt.
- **Officiële sjablonen.** De twaalf Tesla-sjablonen komen uit [teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps). De repo bevat per model alleen het masker: per pixel het paneel-id, gemaakt door `scripts/build_template.py`. Klikken, tekenen en exporteren gebruiken dezelfde vormen.
- **Pc en mobiel.** Pointer Events voor muis, touch en pen.
- **Drie stappen bovenaan**: model, ontwerpen, exporteren. Zo is altijd duidelijk waar je bent en wat de volgende stap is.
- **Layout.** Breed scherm: gereedschap links, canvas midden, eigenschappen en lagen rechts. Smal (< 900 px): gereedschap als vaste balk onderaan. Eén vinger tekent, twee vingers zoomen en verschuiven.
- **Donker thema.** Antraciet in plaats van zwart, één accentkleur (rood) en het lettertype Geist.

## Functies

1. **Model kiezen** uit twaalf modellen in vijf groepen. Bij wisselen wordt het ontwerp gewist, na bevestiging.
2. **Panelen kiezen**: klikken of tikken. Met "Meerdere panelen" of Shift kies je er meer.
3. **Kleurvlak**: massief of verloop, voor de hele wrap of alleen voor de gekozen panelen.
4. **Foto**: voor de hele wrap of per onderdeel. Verplaatsen, vergroten, draaien, spiegelen en dekking.
5. **Tekenen**: kwast en gum met kleur en dikte. Tekeningen blijven binnen de panelen.
6. **Stickers**: PNG, WebP of SVG. Transparante delen blijven doorzichtig, dus het zwart van de achtergrond is eronder zichtbaar.
7. **Tekst**: lettertype, grootte, kleur, vet en draaien.
8. **Zoomen en verschuiven**: knoppen, scrollwiel, twee vingers op de telefoon, en "Naar gekozen paneel".
9. **Symmetrie**: met symmetrie aan worden spiegelpanelen samen gekozen, en worden tekeningen aan beide kanten getekend.
10. **Lagen**: zichtbaar aan of uit, volgorde, verwijderen. Ctrl+Z en Ctrl+Y.
11. **Automatisch opslaan**: bij terugkomst een kaart om door te gaan.
12. **Project** opslaan en openen als JSON, met model, lagen, foto's en stickers. Openen vervangt het huidige ontwerp, na bevestiging.
13. **Export**: controles op formaat, zwart en grootte. Boven 1 MB een palet-PNG die past. Op telefoons die bestanden kunnen delen: een knop om te delen of op te slaan.

## Testen

Playwright (Chromium), op pc (1280 px) en telefoon (390 px, touch). De tests staan niet in de repo.

- **Startpagina**: twaalf modelkaarten, stap 1 actief, exporteren uitgeschakeld tot een model is gekozen.
- **Zoomen**: knoppen, scrollwiel en "Naar gekozen paneel". Op de telefoon: twee vingers.
- **Symmetrie**: zonder symmetrie niets aan de andere kant; met symmetrie aan beide kanten.
- **Stickers**: staan in de export.
- **Automatisch opslaan**: na herladen de herstelkaart; "Doorgaan" herstelt de lagen.
- **Modelwissel en project**: wisselen met bevestiging; project openen geweigerd of bevestigd; project opslaan en openen zet het model terug.
- **Telefoon**: geen horizontale scroll, vaste werkbalk onderaan, canvas hoog op het scherm, export klopt.
- **Alle twaalf modellen**: export op de juiste afmeting, zwart buiten de panelen, gevuld paneel, bestandsnaam volgens de Tesla-eisen.

## Besluiten

- **Voyager is verwijderd.** Het was een eigen sjabloon (960 × 960 px) dat niet in de Tesla-repo staat.
- **Cybertruck op 1024 × 768**, de afmeting van Tesla's sjabloon.
- **Geen backend.** Geen galerij of deellink; zie [IDEEN.md](IDEEN.md).

## Niet getest

- De upload in de Tesla-app zelf.
- Echte iPhone- en Android-toestellen. De telefoontests draaien in Chromium met telefoonformaat en touch.

## Open punten

- **Hosting**: Vercel koppelen aan deze repo (framework "Other", geen build-commando, output directory `.`). Dat vraagt een Vercel-token of een koppeling in het Vercel-dashboard.
- **Productie**: `main` staat nog op de versie vóór de redesign. Pas na bevestiging bijwerken.
- **Symmetrie**: Model X (2021+) heeft drie panelen en de Cybertruck één paneel zonder spiegelpaneel.
