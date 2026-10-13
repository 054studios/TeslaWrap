# Tesla Wrap Ontwerper: plan

## Doel

Een website waarop je zelf een Tesla-wrap ontwerpt en die downloadt als PNG, klaar om te uploaden in de Tesla-app. Een landingspagina met een galerij van voorbeelden leidt naar de editor.

## Eisen uit het sjabloon

- PNG op de afmeting van het gekozen Tesla-sjabloon (1024 × 1024; Cybertruck 1024 × 768), maximaal 1 MB.
- Zwarte achtergrond tussen en rond de panelen, geen witte rand.
- Paneelvormen en -afmetingen van het sjabloon behouden.
- Artwork volledig binnen de panelen.

## Keuzes

- **Statische site** (HTML, CSS, JavaScript), zonder build-stap en zonder externe libraries.
- **Alles in de browser.** Foto's verlaten het apparaat niet. Ontwerpen worden bewaard in de browser (IndexedDB), zodat ze na herladen terugkomen. Accounts en een gedeelde galerij komen later, met Supabase.
- **Officiële sjablonen.** De twaalf Tesla-sjablonen komen uit [teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps). De repo bevat per model alleen het masker: per pixel het paneel-id, gemaakt door `scripts/build_template.py`. Klikken, tekenen en exporteren gebruiken dezelfde vormen.
- **Twee pagina's.** De landingspagina staat op `/` en toont de galerij, hoe het werkt en de voordelen. De editor staat op `/ontwerp/`.
- **Pc en mobiel.** Pointer Events voor muis, touch en pen.
- **Talen.** Nederlands is de bron: de Nederlandse tekst is de sleutel in `js/i18n/<taal>.json`. Een tekst zonder vertaling blijft Nederlands. Vertalingen staan in de repo, dus er is geen build-stap of extern bestand nodig.
- **Drie stappen bovenaan**: model, ontwerpen, exporteren. Zo is altijd duidelijk waar je bent en wat de volgende stap is.
- **Layout.** Breed scherm: gereedschap links, canvas midden, eigenschappen en lagen rechts. Smal (< 900 px): gereedschap als vaste balk onderaan. Eén vinger tekent, twee vingers zoomen en verschuiven.
- **Donker thema.** Antraciet in plaats van zwart, één accentkleur (rood) en het lettertype Geist. De landingspagina gebruikt dezelfde kleuren.

## Functies

1. **Model kiezen** uit twaalf modellen in vijf groepen. Een model maakt een nieuw ontwerp; het vorige blijft in je lijst staan.
2. **Panelen kiezen**: klikken of tikken. Met "Meerdere panelen" of Shift kies je er meer.
3. **Kleurvlak**: massief of verloop, voor de hele wrap of alleen voor de gekozen panelen.
4. **Foto**: voor de hele wrap (geen paneel gekozen), op één paneel, over meerdere panelen samen, of met "Eén foto per paneel" een eigen foto per paneel. Verplaatsen met slepen (Selecteer of Verplaats), vergroten met een hoekje, draaien met het bolletje of met `[` en `]`, en pijltjes voor fijne stappen. Verder spiegelen, dekking en andere afbeelding.
5. **Tekenen**: kwast en gum met kleur en dikte. Tekeningen blijven binnen de panelen.
6. **Stickers**: PNG, WebP of SVG. Transparante delen blijven doorzichtig, dus het zwart van de achtergrond is eronder zichtbaar.
7. **Tekst**: lettertype, grootte, kleur, vet en draaien.
8. **Zoomen en verschuiven**: knoppen, scrollwiel, twee vingers op de telefoon, en "Naar gekozen paneel".
9. **Symmetrie**: met symmetrie aan worden spiegelpanelen samen gekozen, en worden tekeningen aan beide kanten getekend.
10. **Lagen**: zichtbaar aan of uit, volgorde, verwijderen. Ctrl+Z en Ctrl+Y.
11. **Meerdere ontwerpen**: een lijst op de startpagina, met miniatuur. Openen, dupliceren, hernoemen en verwijderen. Alles wordt automatisch bewaard in de browser. Een oud enkel ontwerp wordt eenmalig in de lijst gezet.
12. **Project** opslaan en openen als JSON, met model, naam, lagen, foto's en stickers. Openen maakt een nieuw ontwerp in je lijst.
13. **Galerij** op de landingspagina: voorbeelden met een filter per model. "Openen en aanpassen" maakt een eigen kopie.
14. **Export**: controles op formaat, zwart en grootte. Boven 1 MB een palet-PNG die past. Op telefoons die bestanden kunnen delen: een knop om te delen of op te slaan.
15. **Talen**: Nederlands, English, Deutsch, Français en Türkçe, met een kiezer in de kop. Zonder eigen keuze volgt de site het land, dan de browser, en anders Engels. Alle keuzes worden onthouden.

## Testen

Playwright (Chromium), op pc (1280 px) en telefoon (390 px, touch). De tests staan niet in de repo.

- **Landingspagina**: hero, galerij met filter, een voorbeeld openen (de export is gelijk aan de galerij-afbeelding), telefoon zonder horizontale scroll.
- **Meerdere ontwerpen**: aanmaken per model, openen, dupliceren, hernoemen, verwijderen, herladen, een voorbeeld via de link, een oud enkel ontwerp overzetten, telefoon.
- **Startpagina**: twaalf modelkaarten, stap 1 actief, exporteren uitgeschakeld tot een model is gekozen.
- **Zoomen**: knoppen, scrollwiel en "Naar gekozen paneel". Op de telefoon: twee vingers.
- **Symmetrie**: zonder symmetrie niets aan de andere kant; met symmetrie aan beide kanten.
- **Stickers**: staan in de export.
- **Foto's**: voor de hele wrap, op één paneel, over meerdere panelen en per paneel een eigen foto. Een verkeerd aantal bestanden geeft een melding en voegt niets toe. Foto's blijven staan na autosave en in een project. Verplaatsen, vergroten en draaien: met de muis, met pijltjes, en op de telefoon met één en twee vingers.
- **Automatisch opslaan**: het ontwerp staat na herladen in de lijst en opent met de lagen erop.
- **Model en project**: een ander model en een projectbestand maken een nieuw ontwerp, zonder bevestiging.
- **Telefoon**: geen horizontale scroll, vaste werkbalk onderaan, canvas hoog op het scherm, export klopt.
- **Alle twaalf modellen**: export op de juiste afmeting, zwart buiten de panelen, gevuld paneel, bestandsnaam volgens de Tesla-eisen.
- **Talen**: kiezer en onthouden, land (Turkije), browser, taalwissel in de editor, export in het Engels, telefoon in het Turks zonder horizontale scroll, en een ontbrekende vertaling.
- **Vertalingen**: `scripts/check_i18n.py` controleert of elke tekst in elke taal vertaald is en of de variabelen kloppen.

## Besluiten

- **Voyager is verwijderd.** Het was een eigen sjabloon (960 × 960 px) dat niet in de Tesla-repo staat.
- **Cybertruck op 1024 × 768**, de afmeting van Tesla's sjabloon.
- **Een nieuw model of projectbestand maakt een nieuw ontwerp.** Er is geen bevestiging meer nodig: het vorige ontwerp blijft in de lijst staan.
- **Geen backend nu.** De galerij bevat alleen voorbeelden van ons. Een gedeelde galerij komt later, met Supabase.
- **Taal uit het land.** De eigen keuze van de bezoeker gaat altijd voor. Het land komt van Vercel (`api/country.js`). Lokaal bestaat dat niet; dan geldt de browser.

## Niet getest

- De upload in de Tesla-app zelf.
- Echte iPhone- en Android-toestellen. De telefoontests draaien in Chromium met telefoonformaat en touch.
- Gedeelde galerij en accounts: die zijn nog niet gebouwd.
- De landdetectie op Vercel zelf. Lokaal bestaat `/api/country` niet; de tests nemen het land over.

## Open punten

- **Hosting**: Vercel koppelen aan deze repo (framework "Other", geen build-commando, output directory `.`). Dat vraagt een Vercel-token of een koppeling in het Vercel-dashboard.
- **Productie**: `main` staat op de versie vóór de landingspagina en de meerdere ontwerpen. Bijwerken na bevestiging.
- **Symmetrie**: Model X (2021+) heeft drie panelen en de Cybertruck één paneel zonder spiegelpaneel.
- **Supabase**: voor de gedeelde galerij en accounts. In het account staan nu twee Supabase-projecten; geen van beide is van TeslaWrap. Eerst kiezen we of we een eigen project maken.
- **Vertalingen**: nakijken door moedertaalsprekers (Duits, Frans, Turks). De Tesla-menunamen (Creations, Wrap, Upload) blijven Engels.
