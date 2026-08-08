# 🚗💨 BMW Breakdown

A tiny browser game about the eternal BMW-ownership tax: it breaks down, you pay,
it breaks down again.

## How to play

Open `index.html` in a browser (or serve the folder with any static file server).

- Click **FLOOR IT** to drive — you earn cash and rack up distance.
- Every so often the car breaks down with a (fake, humorous) mechanical excuse.
- You get a short window to **pay the repair cost** and keep going.
- Miss the window and the car dies for good — game over, with your stats.
- Repair costs climb with every fix, and breakdowns get more frequent the
  longer you survive, so the pressure only ramps up.
- Earn enough lifetime cash to unlock pricier, faster, *less reliable* models.

Best survival time and unlocked models are saved locally in your browser
(`localStorage`), so progress persists between sessions.

## Run it locally

```bash
cd bmw-breakdown
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no dependencies — just HTML/CSS/vanilla JS.
