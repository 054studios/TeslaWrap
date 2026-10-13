# Ontwerp van de startpagina

Visuele beslissingen voor de startpagina (`/`), met de bron van elke regel. De editor (`/ontwerp/`) gebruikt sinds de tweede ronde hetzelfde palet, dezelfde vormen en dezelfde pictogrammen; zie het kopje Editor.

## Status

- Het herontwerp zit binnen de bestaande wereld van de editor en van PLAN.md: donker, één rode accent, Geist. De Impeccable-skill zegt dat een bestaande wereld het ontwerp erft; dit document legt haar vast (new-work.md §1, "Established world").
- Nog niet gedaan: het token-schema en `.impeccable/design.json` van de Impeccable-documenter, een finish-review door een aparte reviewer, en een Lighthouse-meting. Zie "Niet gecontroleerd".

## Bronnen

| Bron | Gelezen |
|---|---|
| Impeccable `SKILL.md` | volledig |
| Impeccable references: craft-floor, new-work, mode-persuade, typeset, layout | volledig |
| Impeccable references: animate, clarify, adapt, harden, polish, audit, document | volledig, door een leesagent; de regels die we gebruiken zijn overgenomen |
| Taste `taste-skill/SKILL.md` | regels 1 tot 506 zelf; regels 507 tot 1229 door een leesagent, volledig |
| Redesign `redesign-skill/SKILL.md` | volledig |
| Anthropic frontend-design | volledig |
| Emil Kowalski: emil-design-eng, animate, animation-performance | volledig |
| Vercel web interface guidelines (`vercel-labs/web-interface-guidelines`, `command.md`) | alleen als samenvatting opgehaald; de woordelijke tekst kwam niet terug |

Niet gedraaid: de Impeccable-launcher en de detector (`scripts/impeccable`). De launcher downloadt bij de eerste keer een binary; dat hebben we niet gedaan zonder akkoord. De skill beschrijft daarvoor een terugval: lees PRODUCT.md en DESIGN.md zelf. Die bestaan in deze repo niet, en we hebben ze niet verzonnen. Er is daarom geen `.impeccable/`-map.

## Vastgelegde keuzes

Gepind door de gebruiker en door PLAN.md. Die gaan voor op de keuzeronde van Impeccable (new-work.md §3: "A user- or brief-pinned direction beats the roll, always"). Daarom is `concept-seed` niet gedraaid.

- Donker antraciet met één gedempte rode accent.
- Geist, zelf gehost.
- Autokeuze eerst: één klik op een model opent de editor met dat model.
- Galerij met tien ontwerpen per model, elk met een PNG-download.
- De editor is de hoofdactie. Elke primaire knop gaat erheen.

## Ontwerpbasis

- Design read (Taste 0.B): landingspagina voor een gratis hulpmiddel voor Tesla-eigenaren. Een echte editor is het bewijs.
- Modus: Persuade (mode-persuade.md). Het eerste scherm maakt het aanbod duidelijk, toont de actie, en laat met echte inhoud zien wat alleen dit product kan.
- Scène (new-work §4; een aanname van ons, geen gebruikersdata): iemand ontwerpt zijn wrap op pc of telefoon, vaak bij weinig licht. De editor is donker, en de kleuren van een wrap komen op een donkere ondergrond het best uit. Donker volgt dus uit het gebruik.
- Kleurstrategie: Restrained (new-work §4): neutrale tinten met één accent.
- Dials (Taste 1): VARIANCE 6 (asymmetrische hero en bento, één kolom op telefoon); MOTION 4 (één beweging; Taste verplicht pas boven 4 dat er meer beweging is); DENSITY 3 (ruim).

## Kleur

| Token | Waarde | Gebruik |
|---|---|---|
| `--bg` | #181b21 | pagina |
| `--surface` | #1f232b | banden, bento-cellen |
| `--surface-2` | #272c36 | knoppen, statuscel, achtergrond van een miniatuur |
| `--line` / `--line-strong` | #323845 / #414857 | scheidingen en randen |
| `--text` | #eef1f5 | kopjes en tekst op de primaire knop |
| `--text-2` | #c3cad5 | lopende tekst |
| `--muted` | #9aa3b2 | metadata |
| `--accent` | #b8443d | primaire actie, focusring, streep in het logo |
| `--accent-hover` | #a33b34 | primaire actie bij hover |

Contrast, berekend met de WCAG-formule:

| Combinatie | Ratio | Norm |
|---|---|---|
| tekst op achtergrond | 15,2:1 | tekst, ten minste 4,5:1 |
| tekst-2 op achtergrond | 10,5:1 | tekst, ten minste 4,5:1 |
| metadata op achtergrond | 6,8:1 | tekst, ten minste 4,5:1 |
| tekst op knop (surface-2) | 12,4:1 | tekst, ten minste 4,5:1 |
| tekst op primaire knop | 4,7:1 (bij hover 5,7:1) | tekst, ten minste 4,5:1 |
| accent op achtergrond (focusring) | 3,2:1 | niet-tekst, ten minste 3:1 |

Regels:
- Eén accent, alleen voor de primaire actie, de focusring en de streep in het logo (Taste 4.2, "Color consistency lock"; new-work §4).
- Eén familie van koele neutrale tinten (Taste 4.2).
- Geen puur wit of zwart in de interface (Taste 8.B). De miniaturen zijn PNG-exports van de editor en hebben zwarte buitenkanten. Dat is inhoud, geen interface.
- Alleen donker. Dat is de keuze van de gebruiker; Taste 6.C vraagt daarvoor een uitdrukkelijke instructie. `color-scheme: dark` staat erin. Er is niet op licht getest.

## Typografie

Familie: Geist, zelf gehost, gewichten 400, 500 en 600. Geen tweede familie: typeset.md en de Anthropic-skill vragen om één familie of twee die duidelijk verschillen.

| Rol | Maat / regelhoogte | Gewicht | Regel |
|---|---|---|---|
| h1 | clamp(2,5rem, 4vw, 3,25rem) / 1,04 | 600 | op pc maximaal twee regels, gemeten in NL, EN, DE, FR en TR |
| h2 | clamp(2rem, 4vw, 3rem) / 1,1 | 600 | |
| intro | 20 px / 1,5 | 400 | maximaal 50 tekens breed; maximaal 20 woorden |
| h3 | 20 px / 1,1 | 600 | kaarten, stappen, vragen |
| lopende tekst | 16 px / 1,65, +0,01 em | 400 | maximaal 65 tekens breed |
| knoppen en menu | 15 px (grote knop 17 px) | 500 | |
| metadata | 14 px, tabulaire cijfers | 400 | |
| stapcijfer | 40 px / 1 | 500 | tekst, geen cirkel |

Regels:
- Titels: letter-spacing -0,02 em (craft-floor: ondergrens -0,04 em). Kopjes met `text-wrap: balance`, alinea's met `pretty`.
- Geen eyebrow-labels boven kopjes (craft-floor: "a ban"; Taste 4.7), geen hoofdletterlabels, geen accent op één woord in een kop (Anthropic), geen em- of en-streepjes (Taste 9.G).
- Lopende tekst: 65 tekens. craft-floor zegt 65 tot 75, typeset.md zegt 45 tot 75; we kiezen de smalle kant voor lopende tekst en 50 voor de intro.

## Indeling

| Sectie | Indeling | Waarom |
|---|---|---|
| Hero | tekst links, echt editorbeeld rechts | Persuade: het product bewijst het aanbod. Taste 4.7: kop maximaal twee regels, intro maximaal 20 woorden, primaire knop zichtbaar zonder scrollen, maximaal vier tekstelementen |
| Kies je model | lijstrijen in twee kolommen per auto, met het silhouet | een lange lijst krijgt een andere component dan een raster (Taste 4.9). Rijen hebben alleen een onderlijn, geen kaartvlak (Taste 4.4) |
| Voorbeelden per auto | raster van vijf op pc, vier, drie en twee op telefoon; kaarten zonder vlak | tien per model. De ruimte scheidt de items, niet een kader (Taste P57) |
| Hoe het werkt | drie kolommen, met cijfers als typografie | een echte reeks; de nummers dragen informatie (craft-floor: "unless the sequence itself carries information") |
| Voordelen | bento van zes cellen: één beeldcel over twee kolommen, één statuscel over de volle breedte, vier tekstcellen | cellen = items (Taste: bento cell count); twee cellen met eigen beeld of toon (Taste: bento background diversity) |
| Veelgestelde vragen | definitielijst: vraag links, antwoord rechts; alles zichtbaar | redesign-skill: accordeon vervangen door een lijst naast elkaar |
| Slot | band met vlak, één knop | de pagina eindigt met een echte afsluiting (new-work §6) |
| Voet | disclaimer met link | de niet-verbonden-met-Tesla-mededeling blijft; dat is een feit |

Zeven verschillende indelingen over acht secties (Taste 4.7: ten minste vier). Ruimte: een raster van 4 px (layout.md), secties 112 px boven (80 px op telefoon). Ruimte boven een sectie is groter dan eronder (craft-floor).

## Beweging

- Eén moment: het editorbeeld rolt uit als een wrap, `clip-path` van rechts naar links, 800 ms, `cubic-bezier(0.23, 1, 0.32, 1)`, met 120 ms vertraging. Het komt uit het product (animate.md: "The focal moment must come from this product"). Geen generieke fade-and-rise (animate.md: "not a thesis").
- De tekst staat meteen goed (new-work §6: content visible by default). Geen animaties op secties, geen scroll-reveals, geen parallax (craft-floor: geen identieke intrede per sectie).
- Met weinig beweging (voorkeur): alleen een opacity-overgang van 300 ms. Niet alles uitzetten (audit.md waarschuwt voor een globale kill).
- Indrukken: `scale(0.97)` in 160 ms, alleen `transform` (Emil, animate).
- Hover: alleen kleur of onderstreping, en alleen met `(hover: hover) and (pointer: fine)` (adapt.md; Taste 6.B).
- Geen `transition: all`; geen animatie van breedte, hoogte of marges (animation-performance.md).
- `clip-path` is in recente Chrome en Firefox een composiet-eigenschap (animation-performance.md). Dat is niet op een echt apparaat gemeten.

## Toegankelijkheid

- Eén `h1`; kopniveaus zonder overslag (getest).
- Skip-link naar de inhoud. Focus zichtbaar: 2 px accent met 3 px offset.
- Raakvlakken minstens 44 px (getest op telefoon).
- Taalkiezer 16 px: iOS zoomt anders in op een focusveld (harden.md).
- Alt-teksten beschrijven het beeld: het editorbeeld, het bentobeeld en elk voorbeeld. Het silhouet is `aria-hidden`; de modelnaam staat ernaast.
- Foutmelding van de galerij noemt wat er mislukt is en wat je kunt doen. Het laadscherm is een skeleton zonder tekst en zonder beweging (Taste 4.5).
- Filters zijn knoppen met `aria-pressed`.

## Responsief

Breekpunten volgen de inhoud (adapt.md: "content-driven breakpoints"):

| Breedte | Wat verandert |
|---|---|
| tot en met 1023 px | navigatie verborgen (past niet naast de knoppen); bento in twee kolommen |
| tot en met 900 px | hero in één kolom |
| tot en met 760 px | lijsten, stappen en bento in één kolom; vragen gestapeld |
| tot en met 520 px | galerij in twee kolommen; kleinere marges |
| tot en met 400 px | kop-CTA verborgen (de hero heeft dezelfde knop) |

Veilige zijkanten voor toestellen met een inkeping: `env(safe-area-inset-*)` in de breedte van de inhoud (adapt.md). Hero-hoogte: `100dvh`, met `100vh` als terugval (Taste 3.E).

Getest op 320, 390, 768, 1024, 1280 en 1440 px zonder horizontale scroll. De primaire knop staat op 1280×720, 1366×768 en 1440×900 in beeld.

## Taal

- 241 vertaalsleutels per taal. `scripts/check_i18n.py`: 241/241 in EN, DE, FR en TR.
- In dit herontwerp: twee nieuwe teksten (de foutmelding met herstel en de alt-tekst van het bentobeeld) en één weggehaald ("Voorbeelden laden…", niet meer nodig).
- De intro is in alle talen maximaal 20 woorden: EN 20, DE 19, FR 18, TR 13.
- Lange talen getest: EN, DE, FR en TR op 390, 768, 1024 en 1440 px, zonder overloop en met de kop op twee regels. Duits gaf eerst drie regels op pc; daarom is de kop op pc maximaal 52 px.
- Geen em- of en-streepjes in zichtbare tekst. Gecontroleerd in HTML, CSS, JavaScript en de vier vertalingen.

## Editor

De editor (`/ontwerp/`) is een dichte productinterface. Taste (sectie 13) sluit die uit, daarom nemen we geen componentbibliotheek over. We passen alleen de regels voor kleur, typografie, vormen, toestanden, pictogrammen en beweging toe, en de toegankelijkheidsregels van de Vercel-richtlijnen.

- **Palet:** dezelfde tokens als de startpagina. Het accent is `#b8443d`. Tekst op een primaire knop is `#eef1f5`, niet wit (Taste 8.B).
- **Vormen:** besturing 12 px, vlakken 16 px (Taste 4.4). Pillen zijn een vastgelegde uitzondering voor de chips, de stappenschakelaar en de zoombalk.
- **Pictogrammen:** alle pictogrammen van de editor, ook die in JavaScript, komen uit één sprite (`img/icons.svg`, Tabler Icons, MIT). Lijndikte 1,75 px. De licentie staat in `img/LICENSE-Tabler.txt`.
- **Geen decoratieve blur:** de bovenbalk en de zoombalk zijn effen (Taste 9.A). De schaduw is getint.
- **Bovenbalk:** scheidingen tussen de groepen. Op een telefoon staan de taalkeuze en de knoppen op één regel. Op 400 px of minder heeft alleen de actieve stap een zichtbare naam; de andere namen blijven voor schermlezers.
- **Toegankelijkheid:** `touch-action: manipulation` op knoppen en links; `overscroll-behavior: contain` in de dialoog; de exportvoorbeeld heeft afmetingen; `theme-color` is gelijk aan de achtergrond; een niet-brekende spatie tussen getal en "px".
- **Uitzonderingen:** het wrapvlak en de exportvoorbeeld zijn zwart. Dat is de inhoud van de Tesla-PNG, geen interface.

## Beslissingen bij botsende bronnen

| Onderwerp | Bron A | Bron B | Besluit |
|---|---|---|---|
| Herontwerpen of verbeteren | redesign-skill: "Do not rewrite from scratch" | de vraag "fully redesign"; Impeccable: "Redesign replaces" | het uiterlijk is vervangen; de stack (statische HTML, CSS, JS), de element-id's, de functies en de vertaalsleutels zijn behouden |
| Licht of donker | Taste 6.C en 8.D: beide modi ontwerpen en testen | de keuze van de gebruiker: donker | donker; `color-scheme: dark`; niet op licht getest |
| Kleurstrategie | Impeccable new-work §4: "Color commits at page scale" | de keuze van de gebruiker: "one muted red accent" | de keuze van de gebruiker (craft-floor: "A pinned brief ... overrides anything here") |
| Lettertype | Anthropic en mode-persuade: een eigen gezicht, niet het standaardlettertype | PLAN.md: Geist | Geist, gepind in PLAN.md |
| Lengte van lopende tekst | craft-floor: 65 tot 75 tekens | typeset: 45 tot 75 tekens | 65 tekens; intro 50 |
| Hoogte van de hero | Taste: `min-height: 100dvh` | eerder in dit project: `100svh` | `100dvh`, met `100vh` als terugval |
| Beweging in de hero | craft-floor: "not one identical entrance on every section"; animate: "a generic fade-and-rise is not a thesis" | new-work §6: "keep content visible by default" | één uitrol van het beeld; de tekst staat meteen |
| Stappen als drie gelijke kolommen | Taste P60: "three equal cards" is een AI-kenmerk | een reeks van drie stappen | geen kaartvlakken; de nummers als tekst, omdat ze informatie dragen |
| Kaarten | Taste 4.4: kaarten alleen als verhoging hiërarchie toont | de bento heeft cellen | de bento-cellen zijn de enige vlakken; formaten verschillen en er zijn geen geneste kaarten |
| Rode knop op elke kaart | Anthropic: "spend your boldness in one place" | | neutrale knop; rood blijft voor de primaire actie |
| Logo | eerder: een embleem dat op het Tesla-T lijkt (handelsmerkrisico) | | streepmerk op een afgeronde vierkant, ook als favicon |
| Titels | Vercel: Title Case op koppen en knoppen | redesign-skill en Taste: zinsconstructie | zinsconstructie; Title Case past niet bij Nederlandse tekst |
| Taal bij het eerste bezoek | Vercel: taal uit `navigator.languages`, niet uit het IP | jouw keuze: eerst het land (Turkije geeft Turks) | het land blijft eerst; een bewuste afwijking van Vercel |
| Pictogrammen | Taste: "NEVER hand-roll SVG icons" | eerdere handgetekende pictogrammen | Tabler Icons in één sprite |
| Dichte productinterface | Taste sectie 13: uitgesloten | verzoek om de editor te verbeteren | alleen de toepasselijke regels; geen componentbibliotheek |

## Verificatie

| Controle | Uitslag |
|---|---|
| `e2e_landing3.js` (hero, focus, 320 px) | alles geslaagd |
| `e2e_landing2.js` (autokeuze, galerij, downloads, telefoon) | alles geslaagd |
| `e2e_redesign.js` (kopvolgorde, beweging, raakvlakken, overloop 320 tot 1440 px, hero in beeld) | alles geslaagd |
| `check_langs_redesign.js` (EN, DE, FR, TR op vier breedtes) | alles geslaagd |
| `scripts/check_i18n.py` | 241/241 in EN, DE, FR en TR |
| `e2e_i18n.js`, `e2e_designs.js` | alles geslaagd |
| `e2e_v2.js`, `e2e_photo.js`, `e2e_transform.js` (editor, na de visuele wijzigingen) | alles geslaagd |
| Overloop editor op telefoon | 0 px op 390 px en 0 px op 320 px |
| Bovenbalk editor op telefoon | 109 px op 390 px; 155 px op 320 px |

## Niet gecontroleerd

- Lighthouse en Core Web Vitals: niet gemeten (Taste 6.D). Wel gedaan: afmetingen op afbeeldingen, lazy loading onder de vouw, het LCP-beeld met hoge prioriteit.
- Tekst tot 200% vergroot: niet getest (harden.md).
- Echte apparaten (iPhone, Android): niet getest; alleen Chromium-emulatie.
- Vertalingen EN, DE, FR en TR: door ons gemaakt, niet door een moedertaalspreker gecontroleerd.
- Uploaden van de PNG in de Tesla-app: niet geverifieerd.
- Open Graph-tags: niet toegevoegd, omdat de productie-URL niet bekend is.
- Vercel-regels: alleen als samenvatting gelezen; de woordelijke tekst is niet nagelopen.
- Editor: niet op echte telefoons getest, en het toetsenbord op het wrapvlak niet opnieuw nagelopen.
- Impeccable: de detector, de launcher, de documenter (token-schema en `design.json`) en de finish-review door een aparte reviewer zijn niet gedraaid. Het FINISH-criterium van new-work §5 is daarmee nog niet gehaald.
