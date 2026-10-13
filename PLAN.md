# Tesla Wrap Ontwerper: plan

## Doel

Een website waarop je zelf een Tesla-wrap ontwerpt en die downloadt als PNG, klaar om te uploaden in de Tesla-app.

Eisen uit het sjabloon:

- PNG, exact 1024 × 1024 px, maximaal 1 MB
- Zwarte achtergrond tussen en rond de panelen, geen witte rand
- Paneelvormen en -afmetingen van het sjabloon behouden
- Artwork volledig binnen de panelen

## Keuzes

- **Statische site** (HTML, CSS, JavaScript). Geen build-stap en geen externe libraries, dus gratis te hosten, bijvoorbeeld op GitHub Pages.
- **Alles gebeurt in de browser.** Foto's verlaten het apparaat niet.
- **Sjabloon als masker.** `scripts/build_template.py` maakt van de sjabloonafbeelding een masker (`assets/templates/voyager/mask.png`) met per pixel een paneel-id. Klikken op panelen, tekenen binnen panelen en de export gebruiken dezelfde vormen.
- **Pc en mobiel.** Pointer Events voor muis, touch en pen. Breed scherm: gereedschap links, canvas in het midden, eigenschappen en lagen rechts. Smal (< 900 px): canvas bovenaan, gereedschap daaronder.

## Functies (v1)

1. Panelen kiezen: tikken. Met "Meerdere panelen" of Shift kies je er meer. Alles of niets.
2. Kleurvlak: massief of verloop, voor de hele wrap of alleen voor de gekozen panelen.
3. Foto: voor de hele wrap of per onderdeel (gekozen panelen). Verplaatsen, vergroten, draaien, spiegelen, dekking, opnieuw passen.
4. Tekenen: kwast en gum met kleur en dikte. Tekeningen worden altijd tot de panelen beperkt.
5. Tekst: plaatsen, lettertype, grootte, kleur, vet, draaien.
6. Lagen: zichtbaar aan/uit, omhoog/omlaag, verwijderen. Ongedaan maken en opnieuw (Ctrl+Z / Ctrl+Y).
7. Project opslaan en openen als JSON, inclusief foto's.
8. Export: controles op formaat, zwart, geen witte rand en grootte. Boven 1 MB worden de kleuren teruggebracht tot een palet-PNG die wel past. Op mobiel: Delen / Opslaan.

## Testen

Playwright (Chromium) op desktop en mobiel:

- exportformaat 1024 × 1024 en PNG-geldigheid
- pixels buiten de panelen zijn exact zwart
- bestandsgrootte onder 1 MB, ook bij zware foto's (palet-fallback)
- geen horizontale scroll op een telefoon

## Later (niet in v1)

- Automatisch opslaan in de browser (IndexedDB)
- Meer sjablonen: elk Tesla-model heeft een eigen sjabloon; het script maakt er een masker van
- Vormen, stickers, kleurpaletten

## Open punten

- Welk Tesla-model is het? Dit sjabloon is Voyager. Voor een ander model is het bijbehorende sjabloon nodig.
- Hosting: GitHub Pages voor deze repo.
