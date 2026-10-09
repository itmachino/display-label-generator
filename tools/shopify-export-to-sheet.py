"""Turn a Shopify product export into the sticker sheet (SHOE, PRICE, SKU, SIZES, NOTE).

Shopify admin -> Products -> Export -> All products -> CSV for Excel.
Then (Windows PowerShell, in this folder's parent):

    python tools/shopify-export-to-sheet.py products_export_1.csv sticker-sheet.csv
    python tools/shopify-export-to-sheet.py products_export_1.csv sticker-sheet.csv --only old-sheet.csv

--only old-sheet.csv : keep only the shoes that are in that sheet (e.g. the display shoes).
Without it: every ACTIVE product, except sample sales, cards and products with price 0.

Rules (same as the website and Stock check):
  - SIZES come from the end of each size's SKU ("...-34"), not from the size name
    (Shopify's size "34.5" has the SKU "...-34").
  - Products with no sizes (bags, candles, charms) get an empty SIZES: one sticker each.
  - PRICE = Shopify's current selling price ("Variant Price"), what POS charges.
  - NOTE explains anything to check (prices that differ by size, draft products, price changes).
Import the result into the Google Sheet (File -> Import -> Replace current sheet). The website ignores NOTE.
"""
import collections
import csv
import re
import sys

SKIP = re.compile(r'not for sale|sample sale|thank you card|gift card|as-is', re.I)


def base_size(sku):
    m = re.match(r'^(.+)-(\d{1,3})$', sku)
    return (m.group(1), int(m.group(2))) if m else (sku, None)


def money(x):
    try:
        return f'{float(x):.2f}'
    except ValueError:
        return ''


def compress(nums):
    """[34, 35, 36, 37, 40] -> '34-37, 40'"""
    nums = sorted(set(nums))
    out, i = [], 0
    while i < len(nums):
        j = i
        while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1:
            j += 1
        out.append(f'{nums[i]}-{nums[j]}' if j - i >= 2 else ', '.join(str(n) for n in nums[i:j + 1]))
        i = j + 1
    return ', '.join(out)


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    src, dst = args[0], args[1]
    only = args[args.index('--only') + 1] if '--only' in args else None

    old_by_base = {}
    if only:
        for o in csv.DictReader(open(only, encoding='utf-8-sig')):
            old_by_base[base_size(o['SKU'].strip())[0]] = o

    prods = collections.OrderedDict()
    for r in csv.DictReader(open(src, encoding='utf-8-sig')):
        p = prods.setdefault(r['Handle'], {'title': '', 'status': '', 'vars': []})
        if r['Title'] and not p['title']:
            p['title'] = r['Title'].strip()
        if r.get('Status') and not p['status']:
            p['status'] = r['Status']
        sku = (r['Variant SKU'] or '').lstrip("'").strip()   # Shopify adds ' so Excel keeps it as text
        if sku:
            p['vars'].append((r['Option1 Value'], sku, money(r['Variant Price'])))

    out, skipped = [], collections.Counter()
    for p in prods.values():
        if not p['vars']:
            skipped['no SKU'] += 1
            continue
        in_only = any(base_size(v[1])[0] in old_by_base for v in p['vars'])
        if only and not in_only:
            skipped['not in --only sheet'] += 1
            continue
        if not only and p['status'] != 'active':
            skipped['draft / archived'] += 1
            continue
        if SKIP.search(p['title']):
            skipped['sample sale / card'] += 1
            continue
        sized = not all(opt in ('Default Title', '') for opt, _, _ in p['vars'])
        groups = collections.OrderedDict()
        for opt, sku, price in p['vars']:
            b, s = base_size(sku)
            single = not sized or s is None
            g = groups.setdefault(('ONE', sku) if single else b, {'sku': sku, 'sizes': [], 'prices': [], 'opt': opt, 'single': single})
            if not single:
                g['sizes'].append(s)
            g['prices'].append(price)
        rows = []
        for g in groups.values():
            prices = collections.Counter(x for x in g['prices'] if x)
            price = prices.most_common(1)[0][0] if prices else ''
            notes = []
            if len(prices) > 1:
                notes.append('PRICES DIFFER BY SIZE: ' + ', '.join(sorted(prices)) + ' (sheet uses ' + price + ')')
            name = p['title'] + (' - ' + g['opt'] if g['single'] and sized and g['opt'] not in ('Default Title', '') else '')
            o = old_by_base.get(base_size(g['sku'])[0])
            if o:
                op = money(re.sub(r'[^0-9.]', '', o['PRICE']))
                if op and price and op != price:
                    notes.append(f'OLD STICKER SHEET PRICE WAS {op}, SHOPIFY PRICE IS {price}')
            if p['status'] != 'active':
                notes.append('NOT ACTIVE IN SHOPIFY (' + p['status'] + ')')
            rows.append({'SHOE': name, 'PRICE': price, 'SKU': g['sku'],
                         'SIZES': '' if g['single'] else compress(g['sizes']), 'NOTE': '; '.join(notes)})
        if all(not r['PRICE'] or float(r['PRICE']) == 0 for r in rows):
            skipped['price 0'] += 1
            continue
        out.extend(rows)

    out.sort(key=lambda r: r['SHOE'].lower())
    with open(dst, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['SHOE', 'PRICE', 'SKU', 'SIZES', 'NOTE'])
        w.writeheader()
        w.writerows(out)
    stickers = sum(max(1, sum(int(b) - int(a) + 1 if b else 1 for a, b in re.findall(r'(\d+)(?:-(\d+))?', r['SIZES']))) for r in out)
    print(f'{dst}: {len(out)} rows, {stickers} stickers to choose from. Skipped: {dict(skipped)}')


if __name__ == '__main__':
    main()
