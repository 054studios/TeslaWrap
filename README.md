# Tesla Wrap Ontwerper

Ontwerp je eigen Tesla-wrap in de browser en download hem als 1024 × 1024 PNG, klaar voor de Tesla-app.

Het ontwerp staat in [PLAN.md](PLAN.md).

## Draaien

De site gebruikt ES-modules, dus open hem via een webserver en niet als los bestand:

    python3 -m http.server 8000

Ga daarna naar http://localhost:8000.

## Structuur

- `index.html`, `css/style.css`: interface, responsief voor pc en telefoon
- `js/app.js`: gereedschap, lagen, eigenschappen, project en export
- `js/render.js`: tekent de lagen. Dezelfde code levert het voorbeeld en de export.
- `js/template.js`: laadt het paneel-masker, hit-test en paneelomlijning
- `js/export.js`: PNG-export met controles, en een palet-PNG als het bestand boven 1 MB komt
- `js/model.js`, `js/util.js`: geschiedenis (ongedaan maken) en kleine hulpfuncties
- `assets/templates/voyager/`: masker (`mask.png`) en paneelnamen (`panels.json`)
- `scripts/build_template.py`: maakt het masker uit een sjabloonafbeelding

## Nieuw sjabloon

    python3 scripts/build_template.py sjabloon.jpg assets/templates/<naam> --name "<naam>" --preview preview.png

Controleer `preview.png`: elk paneel krijgt een eigen kleur en de vormen moeten kloppen. Voeg daarna het sjabloon toe aan `TEMPLATE_DIR` in `js/app.js`.

## Hosten

Zet de repo op GitHub Pages (Settings → Pages → branch `main`, map `/`). De site werkt zonder build-stap.
