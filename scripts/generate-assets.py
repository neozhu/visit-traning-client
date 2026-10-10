from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'miniprogram' / 'assets'
root.mkdir(parents=True, exist_ok=True)
paths = {
 'user': '<circle cx="24" cy="15" r="7"/><path d="M10 40v-4a14 14 0 0 1 28 0v4Z"/>',
 'book': '<path d="M7 8h13a7 7 0 0 1 4 3 7 7 0 0 1 4-3h13v30H28a7 7 0 0 0-4 3 7 7 0 0 0-4-3H7Z"/><path d="M24 11v30M12 17h7M12 23h7M29 17h7M29 23h7"/>',
 'truck': '<path d="M5 12h24v23H5ZM29 21h9l6 8v6H29"/><circle cx="14" cy="36" r="4"/><circle cx="36" cy="36" r="4"/><path d="M33 24v6h10"/>',
 'helmet': '<path d="M7 32h34v7H7ZM11 32V25a13 13 0 0 1 26 0v7M20 12h8v20M14 22v7M34 22v7"/>',
 'factory': '<path d="M5 40V22l13-8v10l13-8v24ZM34 40V7h7v33M10 30h3M21 30h3M10 36h3M21 36h3"/>',
 'flask': '<path d="M17 6h14M20 6v15L8 39a2 2 0 0 0 2 3h28a2 2 0 0 0 2-3L28 21V6M15 29h18"/><circle cx="22" cy="35" r="1"/>',
 'building': '<path d="M9 42V6h30v36M5 42h38M18 42V31h12v11M16 13h3M29 13h3M16 21h3M29 21h3"/>',
 'shield': '<path d="M24 4 41 11v11c0 11-9 18-17 22C16 40 7 33 7 22V11Z"/><path d="m16 23 6 6 11-12"/>',
 'search': '<circle cx="21" cy="21" r="13"/><path d="m31 31 11 11"/>',
 'check': '<path d="m11 25 9 9L38 14"/>'
}
for name, path in paths.items():
 for suffix, color in [('', '#2e65b5'), ('-white', '#ffffff')]:
  svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="{color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">{path}</g></svg>'
  (root / f'{name}{suffix}.svg').write_text(svg, encoding='utf-8')
campus = '''<svg xmlns="http://www.w3.org/2000/svg" width="750" height="420" viewBox="0 0 750 420">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#d8ebff"/><stop offset="1" stop-color="#f6fbff"/></linearGradient><linearGradient id="wall" x2="1" y2="1"><stop stop-color="#e7edf4"/><stop offset="1" stop-color="#bbcddd"/></linearGradient></defs>
<rect width="750" height="420" fill="url(#sky)"/>
<g fill="#fff" opacity=".7"><ellipse cx="625" cy="78" rx="64" ry="15"/><ellipse cx="576" cy="82" rx="50" ry="11"/><ellipse cx="720" cy="140" rx="85" ry="13"/></g>
<path d="M0 360Q160 328 290 353T750 336V420H0" fill="#d1e3dd"/>
<path d="M363 286 652 206 740 240 453 325Z" fill="#809bb4"/>
<path d="M363 286 453 325V399L363 352Z" fill="#bfd0df"/>
<path d="M453 325 740 240V358L453 412Z" fill="url(#wall)"/>
<path d="M430 225 621 179 673 199 480 250Z" fill="#9bb3c9"/>
<path d="M430 225 480 250V324L430 302Z" fill="#d4e0ea"/>
<path d="M480 250 673 199V273L480 326Z" fill="#e9f0f5"/>
<g fill="#5988ae"><path d="m493 265 31-8v18l-31 8ZM539 253l31-8v18l-31 8ZM585 241l31-8v18l-31 8ZM631 229l28-7v18l-28 7ZM476 339l31-9v20l-31 9ZM524 325l31-9v20l-31 9ZM572 311l31-9v20l-31 9ZM620 297l31-9v20l-31 9ZM668 283l31-9v20l-31 9Z"/></g>
<path d="m578 367 45-12v37l-45 8Z" fill="#3a6284"/>
<g fill="#8bad9b"><ellipse cx="346" cy="365" rx="31" ry="13"/><ellipse cx="737" cy="376" rx="35" ry="13"/><ellipse cx="683" cy="386" rx="28" ry="12"/></g>
<path d="m304 404 437-54" stroke="#b6ced0" stroke-width="5"/>
</svg>'''
(root / 'campus.svg').write_text(campus, encoding='utf-8')
for name in ['home', 'user']:
 for active in [False, True]:
  image = Image.new('RGBA', (96, 96))
  draw = ImageDraw.Draw(image)
  color = '#1768ee' if active else '#68758a'
  if name == 'home':
   draw.line([(15,44),(48,16),(81,44)], fill=color, width=6, joint='curve')
   draw.rounded_rectangle((25,42,71,80), radius=3, outline=color, width=5, fill=color if active else None)
   draw.rectangle((42,58,54,80), fill='white' if active else color)
  else:
   draw.ellipse((34,13,62,41), outline=color, width=5, fill=color if active else None)
   draw.arc((19,44,77,96), 180, 360, fill=color, width=5)
   draw.line([(19,70),(19,80),(77,80),(77,70)], fill=color, width=5)
   if active: draw.rounded_rectangle((23,59,73,79), radius=8, fill=color)
  image.save(root / f"{name}{'-active' if active else ''}.png")
print('Generated SVG illustrations and native tab icons')
