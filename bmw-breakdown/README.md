# 🚗💨 BMW Breakdown

An endless runner about the eternal BMW-ownership tax: it breaks down, it
costs you, and it breaks down again.

## How to play

Open `index.html` in a browser (or serve the folder with any static file
server).

- The car drives itself, behind-the-wheel Crash-Bandicoot style. You steer
  between 3 lanes and jump.
- **← → or A / D** switch lanes. **Space or ↑** jumps. On-screen buttons work
  too, for mouse or touch.
- Motor faults (🛢️) sit in a lane — drive through one to collect oil.
- Service shops (🏪) sit behind a ramp — jump while passing through that lane
  to clear one for free. Get caught grounded in that lane and it costs 10% of
  your current oil, plus a life.
- **3 lives.** Lose them all and it's dead for good — game over, with your
  stats.
- The road gets faster and busier the farther you drive.
- Earn enough lifetime oil to unlock pricier, faster, *less reliable* models.

Best distance and unlocked models are saved locally in your browser
(`localStorage`), so progress persists between sessions.

## Run it locally

```bash
cd bmw-breakdown
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no dependencies — just HTML/CSS/vanilla JS (Canvas 2D for the
game view).
