# Tesla Wrap Ontwerper: plan

## Doel

Een website waarop je zelf een Tesla-wrap ontwerpt en die downloadt als PNG, klaar om te uploaden in de Tesla-app.

Eisen uit het sjabloon:

- PNG, op de afmeting van het gekozen Tesla-sjabloon (1024 × 1024; Cybertruck 1024 × 768), maximaal 1 MB
- Zwarte achtergrond tussen en rond de panelen, geen witte rand
- Paneelvormen en -afmetingen van het sjabloon behouden
- Artwork volledig binnen de panelen

## Keuzes

- **Statische site** (HTML, CSS, JavaScript), zonder build-stap en zonder externe libraries.
- **Alles in de browser.** Foto's verlaten het apparaat niet.
- **Officiële sjablonen.** De twaalf Tesla-sjablonen komen uit [teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps). De repo bevat per model alleen het masker: per pixel het paneel-id, gemaakt door `scripts/build_template.py`. Klikken op een paneel, tekenen binnen de panelen en de export gebruiken dezelfde vormen.
- **Pc en mobiel.** Pointer Events voor muis, touch en pen. Breed scherm: gereedschap links, canvas midden, eigenschappen rechts. Smal (< 900 px): canvas bovenaan, gereedschap daaronder.

## Functies (v1)

1. Model kiezen uit 13 modellen. Bij wisselen wordt het ontwerp gewist, na bevestiging.
2. Panelen kiezen: tikken. Met "Meerdere panelen" of Shift kies je er meer. Alles of niets.
3. Kleurvlak: massief of verloop, voor de hele wrap of alleen voor de gekozen panelen.
4. Foto: voor de hele wrap of per onderdeel. Verplaatsen, vergroten, draaien, spiegelen, dekking. Op de telefoon knijpen om te vergroten of te draaien.
5. Tekenen: kwast en gum met kleur en dikte. Tekeningen blijven binnen de panelen.
6. Tekst: lettertype, grootte, kleur, vet, draaien.
7. Lagen: zichtbaar aan/uit, omhoog/omlaag, verwijderen. Ctrl+Z en Ctrl+Y.
8. Project opslaan en openen als JSON, inclusief foto's en model.
9. Export: controles op formaat, zwart en grootte. Boven 1 MB een palet-PNG die past. Op telefoons die bestanden kunnen delen: knop "Delen / Opslaan".

## Testen

Playwright (Chromium), op desktop en telefoon:

- Elk model: export op de juiste afmeting, zwart buiten de panelen, gevuld paneel, bestandsnaam volgens de Tesla-eisen.
- Model wisselen met bevestiging; project met model opslaan en openen.
- Geen horizontale scroll op de telefoon, knijpen, ongedaan maken, zware foto (palet-fallback), slepen.

## Later

- Automatisch opslaan in de browser (IndexedDB)
- Symmetrie: panelen links en rechts spiegelen
- Vormen, stickers, kleurpaletten

## Open punten

- Cybertruck: exporteren op 1024 × 768 (Tesla's sjabloon) of op 1024 × 1024 (jouw eis)?
- Voyager-sjabloon in de lijst houden?
- Hosting: Vercel koppelen aan deze repo (zie README).
