# Kilo Agent — Electronics & Pickup Configuration Plan

## Global Defaults
- **Any Hardware option that includes a "Chrome" choice → default = Chrome.**
- **Every other option (non-hardware) → default = Black.**
These two rules apply everywhere below unless a more specific rule overrides them.

---

## 1. Electronics Type

**Options:** `Passive` | `Active`

### 1a. Passive
Standard pickup routing. Full access to Pickup Configuration, Pickup Model, Pickup Color, Pickup Pole Pieces, and Controls as defined in Sections 2–6.

### 1b. Active
- Locks pickup models to **Fluence-Neck** and **Fluence-Bridge**.
- Available sub-options:
  - **Pickup Color**
    - **Painted Color**
      - **Color (RGB)** — apply via masks:
        - `models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-bridge-mask.png`
        - `models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-neck-mask.png`
  - **Controls** — identical option set to Passive (see Section 6).

---

## 2. Pickup Configuration

**Options:** `Two Humbuckers` | `Humbucker - Single - Humbucker (H-S-H)`

- **Two Humbuckers** → Pickup Model limited to Bridge + Neck lists (Section 3).
- **H-S-H** → unlocks the **Single Coil** category in Pickup Model (Section 3), and enables the Single Coil asset paths:
  - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/`
  - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/`
  - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/`
- If **not** H-S-H → only Bridge and Neck options are shown in Pickup Model.

---

## 3. Pickup Model

### Bridge
- Beryllium Humbucker
- Holdsworth Humbucker
- Lithium Humbucker
- Illusionist Humbucker
- M12SD
- Thorium Humbucker
- **Vantium Humbucker** *(default)*

### Neck
- Beryllium Humbucker
- Holdsworth Humbucker
- Lithium Humbucker
- Empyrean Humbucker
- **Vantium Humbucker** *(default)*
- Delete Neck Pickup

### Single Coil *(only shown if Pickup Configuration = H-S-H)*
- Lithium Single Coil
- Beryllium Single Coil
- Single Coil
- Twin Blade

---

## 4. Pickup Color

**Options:** `Bobbin Colors` | `Painted Bobbins (RGB)` | `Wooden Bobbins` | `Covers`

### 4a. Bobbin Colors (Open)
Path: `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/open/bobbins`
→ Default color: **Black**

### 4b. Painted Bobbins
Apply chosen **RGB** value directly to bobbin material.

### 4c. Wooden Bobbins
Use the wood swatch selected from the woods library, applied via masks:
`cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/{coil-masks-neck, coil-masks-middle-single, coil-masks-bridge, coil-masks-middle-single-route}`

> For **4a, 4b, 4c** (all "Open" body styles), Pole Pieces use the **Open** path:
> - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/{pole-piece-color}-neck`
> - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/{pole-piece-color}-bridge`
>
> Pickup Bodies path:
> `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/`

### 4d. Covers
- Pole Pieces (Covered):
  - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/{pole-piece-color}-neck`
  - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/{pole-piece-color}-bridge`
- Pickup Bodies (Covered):
  - `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered`
- Default cover color: **Black** (Chrome available → see Section 5 for hardware-tier default logic if Cover is treated as hardware).

---

## 5. Pickup Pole Pieces

**Options:** `Black` | `Chrome` | `Gold`
**Default: Chrome** *(hardware item with a Chrome option → applies global hardware rule)*

### Routing logic
| Pickup Color choice | Pole Piece path used |
|---|---|
| Covers selected | `.../pole-pieces/humbucker/covered/{color}-neck` & `.../covered/{color}-bridge` |
| Covers NOT selected (Bobbin/Painted/Wooden) | `.../pole-pieces/humbucker/open/{color}-neck` & `.../open/{color}-bridge` |

Base open path: `cosmoscraft_assets/electric_assets/dc_assets/models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/`

---

## 6. Controls

**Options:** `Off` | `Delete Tone Control (DTC)` | `Delete Tone Control and Move Volume to Tone Position (DTMV)`

### Knob asset key logic
Knob image filenames encode the control mode as a suffix key:
- Contains `-dtc` → apply when **Delete Tone Control (DTC)** is selected.
- Contains `-dtmv` → apply when **DTMV** is selected.
- No `-dtc` / `-dtmv` suffix present → treat as the **Off** option (default control state).

Example: `plastic-black-dtc` → used only when Controls = DTC.
Default knob color follows the global rule: **Black** (knobs are not a "hardware with chrome" item unless a chrome knob variant exists — if it does, apply Chrome per the global hardware rule).

---

## 7. Default Summary Table

| Category | Default Value | Reason |
|---|---|---|
| Electronics Type | Passive | Base/simple starting config |
| Pickup Configuration | Two Humbuckers | Base/simple starting config |
| Bridge Pickup Model | Vantium Humbucker | Chosen baseline model |
| Neck Pickup Model | Vantium Humbucker | Chosen baseline model |
| Pickup Color | Bobbin Colors — Black | Non-hardware → Black default |
| Pickup Pole Pieces | Chrome | Hardware w/ Chrome option → Chrome default |
| Controls | Off | No suffix key present |
| Knobs | Black (or Chrome if a chrome variant exists) | Global rule |

---

## 8. Decision Flow (high level)

```
Electronics Type?
├─ Passive
│   └─ Pickup Configuration?
│       ├─ Two Humbuckers → Pickup Model [Bridge/Neck only]
│       └─ H-S-H → Pickup Model [Bridge/Neck/Single Coil]
│           └─ Pickup Color?
│               ├─ Bobbin Colors (default Black)
│               ├─ Painted Bobbins (RGB)
│               ├─ Wooden Bobbins (wood mask)
│               └─ Covers (covered paths)
│                   └─ Pickup Pole Pieces: Black / Chrome(default) / Gold
│                       └─ path = open or covered, per Pickup Color choice
│       └─ Controls: Off(default) / DTC / DTMV → knob key lookup
└─ Active
    └─ Fluence-Neck + Fluence-Bridge locked
        └─ Pickup Color → Painted Color → RGB (fluence masks)
        └─ Controls: same as Passive
```