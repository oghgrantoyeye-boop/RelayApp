# Design references

- `mocks/P2-*.dc.html` are the polished Relay screens (Queue, Application, Unit, Athlete). They were exported from a Claude design canvas and load a `./support.js` runtime that isn't included, so treat them as markup and style references rather than pages that open on their own.
- `source/` holds the Python that generated them. `gen2.py` defines the design tokens (Geist 13px; ink #18181b, muted #5f5f6b, line #e6e6ea, soft #f6f6f7, blue #1d4ed8; tone pills) and the components: sidebar, topbar, metric, AI card, department track, role switch.
- The `screens2*.py` files hold the seed copy used in SPEC.md.
