# RouterHaus – Static Site Setup

## Rebuild Tailwind
Compile Tailwind into `docs/main.css`:
```bash
npx tailwindcss -i input.css -o docs/main.css --minify
```

## Preview Locally
Serve the `docs/` folder with any static server:
```bash
npx serve docs
# or
python -m http.server -d docs
```

## Structure
- `docs/` – production site (HTML, assets)
- `input.css` – Tailwind source
- `tailwind.config.js` – Tailwind settings

## Notes
- This repository is intentionally unlicensed.
- Do **not** edit `index.html` unless prompted—Codex may manage it.
- All other files are safe to modify.
