# Display Label Generator

A small website that makes **price stickers for display shoes**.

Website: **https://itmachino.github.io/display-label-generator/**

Each sticker shows the **shoe**, the **price** and a **barcode** of the SKU.

```text
┌──────────────────────────────────┐
│ Hana OG Flats                    │
│ in White             RM 148.00   │  ← name big and bold, price small
│──────────────────────────────────│
│ ║▌║║▌▌║▌║║▌║▌║║▌║▌▌║║▌║▌║║▌║║▌  │
│ ║▌║║▌▌║▌║║▌║▌║║▌║▌▌║║▌║▌║║▌║║▌  │
└──────────────────────────────────┘
   50 × 30 mm · NIIMBOT B1
```

Long names fit by themselves: first a little smaller, then 2 lines, then 3 smaller lines.
The price is always smaller than the name. Only a very long name (about 60+ characters) gets its last words left off.

## Why the barcode matters most

The barcode is the shoe's **SKU from Shopify**, e.g. `1800044001-36`.

When staff scan it with the **Stock check** tile on the POS phone, they see the stock for every size.
If the SKU is wrong, the scan finds nothing. So the website checks every barcode before it prints.

## How it works

```mermaid
flowchart LR
  A[Google Sheet] --> B[This website] --> C[PDF] --> D[NIIMBOT app] --> E[Sticker]
```

1. Staff type the shoes into the **Google Sheet** (one row per sticker).
2. Open the website. The list **loads by itself**.
3. Look at the preview. Fix any row in **red** in the sheet, wait 1–2 minutes, then press **Load**.
4. Press **Download PDF**.
5. Open the PDF in the **NIIMBOT** app. Print at **100% size** (no "fit" or "scale").

Print **one** sticker first, scan it with Stock check, then print the rest.

## The sheet

Row 1 must be:

| Column | What to type | Example |
|---|---|---|
| **SHOE** | Shoe name | Lara Slingback Heels |
| **PRICE** | Price in RM, numbers only | 208.00 |
| **SKU** | The SKU, exactly as in Shopify. This is the barcode. | 1800044001-36 |
| COPIES *(optional)* | How many stickers (empty = 1) | 2 |

The team sheet is built into the website, in `USUAL_SHEET_URL` in `index.html`, so it is always there.

- **To use another sheet on one computer:** paste its link in the box and press **Load**. That computer remembers it.
- **To go back:** press **Use the usual sheet**. **Clear** empties the box.
- **To change the sheet for everyone:** change `USUAL_SHEET_URL` and save to GitHub.

`sheet-template.csv` has the columns. A new sheet must be published: **File → Share → Publish to web**, as **CSV**.

## What is on the page

| Part | What it does |
|---|---|
| **Your sticker list** | Loads the team sheet by itself. Or paste another sheet link, or drop a CSV file. |
| **Print stickers for** | Print everything, or only one shoe. |
| **Template** | **Standard** (big name, small price, line, barcode), **Big price** (big bold price at the end of the name) or **Barcode only** (biggest bars). |
| **Sticker settings** | Text sizes; show or hide shoe, price, size (from SKU), SKU text under the barcode, a line above the barcode; auto-fit long names. Remembered on this computer. **Reset to default** goes back to the standard sticker. |
| **Preview** | Every sticker, exactly as it prints. **Download just this sticker** for a test print. |
| **Barcode measurements** | Bar width, bar height, quiet zone, density and the read-back check, with ✓ or ✗. |
| **Red / yellow lists** | Red rows will not print until fixed. Yellow rows print, but have a look. Click a row to see it. |

## What the website checks

| Check | If wrong |
|---|---|
| PRICE and SKU are filled in | Red: will not print |
| PRICE is a number (e.g. 208.00) | Red: will not print |
| SKU has only letters, numbers and "-", no spaces | Red: will not print |
| The same SKU has the same shoe and price on every row | Red: will not print |
| The barcode fits on the sticker | Red: will not print |
| The barcode reads back correctly (a barcode reader checks it) | Red: will not print |
| SHOE is empty | Yellow: prints with no name |
| SKU looks like our usual SKU (10 numbers, "-", size) | Yellow: prints, but check it |
| SKU has a letter O, I or l (maybe meant 0 or 1) | Yellow: prints, but check it |
| Shoe name very long: printed small (7pt) on 3 lines | Yellow: prints, but check it is easy to read |
| Shoe name too long even on 3 small lines, last words left off | Yellow: prints, but shorten it in the sheet |
| Bars shorter than 10 mm | Yellow: prints, but check it |

## How the barcode is made (for IT)

- **Type:** Code 128, the same type as our other shoe labels. Every POS scanner and phone camera reads it.
- **Bar width:** the NIIMBOT B1 prints 8 dots per mm. Every bar is a whole number of dots: as wide as fits (4, 3 or at least 2 dots = 0.25 mm). Bars never get rounded thinner or thicker by the printer.
- **Quiet zone:** a blank space 10 bars wide at both ends, inside the part of the sticker the B1 prints.
- **Drawing:** bars are exact shapes in the PDF, not a picture, so they stay sharp.
- **Check:** before printing, each barcode is drawn at the printer's resolution and read back with a barcode reader (ZXing). It must give back the same SKU.

Built from two earlier tools: the [Photoshoot Label Generator](https://itmachino.github.io/label-generator/) (sheet loading, settings, checks) and the [david-lee-mac Label Generator](https://david-lee-mac.github.io/label-generator/) (templates, barcode measurements, drop-a-CSV).

## Files in this folder

| File | What it is |
|---|---|
| `README.md` | This page. Start here. |
| `index.html` | The whole website, in one file. |
| `sheet-template.csv` | The columns the Google Sheet must have. |
| `test-data/test-stickers.csv` | 6 test stickers, for the print test. |
| `test-data/test-stickers.pdf` | Those 6 stickers, ready to print. |
| `test-data/bad-rows.csv` | Rows with mistakes, to check the website catches them. |

**Test stickers are for testing only.** Their prices are examples. Do not put them on shoes.

## Print test (do this before using it for real)

Print `test-data/test-stickers.pdf`. Every sticker must pass all checks:

| # | SKU | Stock check shows the right shoe | POS Search scanner finds it | Phone camera reads it |
|---|---|---|---|---|
| 1 | 1800044001-36 | | | |
| 2 | 1800018003-35 | | | |
| 3 | 1800044001 | | | |
| 4 | 1800018003-42 | | | |
| 5 | 1800018003-40 | | | |
| 6 | 1800018003-41 | | | |

Pass = every box ticked, each scan works the first time.

## Changing the website

1. Edit `index.html`.
2. Open it in a browser. Drop `test-data/test-stickers.csv` on the CSV box.
3. Check the barcode measurements all show ✓.
4. Save to GitHub:

   PowerShell (Windows)
   ```powershell
   git add .
   git commit -m "Short note of what changed"
   git push
   ```

The website updates by itself in about a minute.
