#!/usr/bin/env python3
"""Рисует бейджи ролей, которые видят только «свои».

Обычный игрок — цветной шарик из playerBadges/*.png. Нечто и заражённые вместо
шарика показываются своими картинками, чтобы роль читалась по самому кружку, а
не по гирлянде иконок-статусов поверх него. Обе сделаны по игровым картам:

  thing.png    — кадр карты «Нечто»: светящийся череп ктулху и жёлтые глаза;
  infected.png — щупальца, как на карте «Заражение!», обвивают кружок игрока.

Так «морда = нечто», «щупальца = заражённый» различаются на столе мгновенно, а
стиль остаётся ровно тем же, что у карт.

Картинки собираются как SVG и растрируются rsvg-convert (librsvg). Перерисовать:

    python3 scripts/genRoleBadges.py

Результат кладётся прямо в src/client/resources/images/playerBadges/, файлы под
гитом — запускать нужно только когда меняется сама графика.
"""
import base64
import math
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESOURCES = os.path.join(ROOT, 'src', 'client', 'resources')
CARD = os.path.join(RESOURCES, 'cards', 'thing.png')
BADGES = os.path.join(RESOURCES, 'images', 'playerBadges')

CARD_W, CARD_H = 500, 700     # размер исходной карты
S = 256                       # холст бейджа
C = S / 2
R = 124.0                     # радиус круга: во весь холст, как у обычных бейджей


def data_uri(path):
	with open(path, 'rb') as f:
		return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


def badge(crop, brightness, saturation, rim, veil):
	"""Кадр карты, обрезанный в круг.

	crop — (x, y, сторона) квадрата на карте; яркость/насыщенность правятся
	фильтром, veil — тёмная подложка в центре, чтобы белый ник читался поверх.
	"""
	x0, y0, side = crop
	s = S / side
	return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
 <defs>
  <clipPath id="ball"><circle cx="{C}" cy="{C}" r="{R}"/></clipPath>
  <filter id="grade" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
   <feComponentTransfer>
    <feFuncR type="linear" slope="{brightness}"/>
    <feFuncG type="linear" slope="{brightness}"/>
    <feFuncB type="linear" slope="{brightness}"/>
   </feComponentTransfer>
   <feColorMatrix type="saturate" values="{saturation}"/>
  </filter>
  <radialGradient id="edge" cx="50%" cy="50%" r="50%">
   <stop offset="62%" stop-color="#000000" stop-opacity="0"/>
   <stop offset="100%" stop-color="#000000" stop-opacity="0.8"/>
  </radialGradient>
  <radialGradient id="veil" cx="50%" cy="50%" r="50%">
   <stop offset="0%" stop-color="#040603" stop-opacity="{veil}"/>
   <stop offset="65%" stop-color="#040603" stop-opacity="{veil * 0.35:.2f}"/>
   <stop offset="100%" stop-color="#040603" stop-opacity="0"/>
  </radialGradient>
 </defs>
 <g clip-path="url(#ball)">
  <rect width="{S}" height="{S}" fill="#040602"/>
  <g filter="url(#grade)" transform="translate({-x0 * s:.2f},{-y0 * s:.2f}) scale({s:.4f})">
   <image href="{data_uri(CARD)}" x="0" y="0" width="{CARD_W}" height="{CARD_H}"/>
  </g>
  <circle cx="{C}" cy="{C}" r="{R}" fill="url(#edge)"/>
  <circle cx="{C}" cy="{C + 10}" r="{R * 0.6:.1f}" fill="url(#veil)"/>
 </g>
 <circle cx="{C}" cy="{C}" r="{R - 1}" fill="none" stroke="{rim}" stroke-opacity="0.5" stroke-width="3"/>
 <circle cx="{C}" cy="{C}" r="{R + 1}" fill="none" stroke="#0a1004" stroke-width="5"/>
</svg>'''


def thing_badge():
	# Череп и глаза целиком: центр бейджа приходится на «бороду» из щупалец,
	# так что белый ник ложится на тёмное.
	return badge(crop=(20, 150, 460), brightness=1.12, saturation=1.15, rim='#cfe86f', veil=0.5)


# --------------------------------------------------------------- ЗАРАЖЁННЫЙ
# Щупальца рисуются вектором: на карте «Нечто» они уходят в чёрное, а на карте
# «Заражение!» вплетены в лицо — вырезать нечего, зато форма и палитра оттуда.

def catmull(points, per=18):
	"""Гладкая линия через опорные точки."""
	pts = [points[0]] + list(points) + [points[-1]]
	out = []
	for i in range(len(pts) - 3):
		p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
		for j in range(per):
			t = j / per
			t2, t3 = t * t, t * t * t
			x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
			           + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
			y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
			           + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
			out.append((x, y))
	out.append(points[-1])
	return out


def normals(pts):
	out, n = [], len(pts) - 1
	for i, (x, y) in enumerate(pts):
		nx, ny = pts[min(i + 1, n)]
		px, py = pts[max(i - 1, 0)]
		dx, dy = nx - px, ny - py
		ln = math.hypot(dx, dy) or 1
		out.append((-dy / ln, dx / ln))
	return out


def band(pts, ws, shift=0.0):
	"""Полоса заданной толщины вдоль линии; shift — сдвиг по нормали (в долях толщины)."""
	left, right = [], []
	for (x, y), (ox, oy), w in zip(pts, normals(pts), ws):
		cx, cy = x + ox * shift * w, y + oy * shift * w
		left.append((cx + ox * w / 2, cy + oy * w / 2))
		right.append((cx - ox * w / 2, cy - oy * w / 2))
	return 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in left + right[::-1]) + ' Z'


def taper(n, w0, w1=4.5, wave=0.1, cycles=3.0):
	"""Сужение от корня к кончику с лёгкой волной — щупальце не ровная труба."""
	return [(w0 + (w1 - w0) * (i / n) ** 1.25) * (1 + wave * math.sin((i / n) * cycles * math.pi))
	        for i in range(n + 1)]


def suckers(pts, ws, start=0.25, step=7):
	out, ns, n = [], normals(pts), len(pts) - 1
	i = int(n * start)
	while i < n * 0.94:
		(x, y), (ox, oy), w = pts[i], ns[i], ws[i]
		out.append(f'<circle cx="{x + ox * w * 0.2:.1f}" cy="{y + oy * w * 0.2:.1f}" '
		           f'r="{max(1.6, w * 0.15):.1f}" fill="#20250a" opacity="0.8"/>')
		i += step
	return ''.join(out)


def tentacle(way, w0, light=-0.28):
	pts = catmull(way)
	ws = taper(len(pts) - 1, w0)
	return (
		f'<path d="{band(pts, ws)}" fill="url(#tent)" stroke="#152309" stroke-width="3" stroke-linejoin="round"/>'
		f'<path d="{band(pts, [w * 0.5 for w in ws], shift=0.25)}" fill="#22380f" opacity="0.45" filter="url(#blur)"/>'
		f'<path d="{band(pts, [w * 0.26 for w in ws], shift=light)}" fill="#d3f08a" opacity="0.85" filter="url(#blur)"/>'
		f'<path d="{band(pts, [w * 0.1 for w in ws], shift=light - 0.04)}" fill="#f2fbd8" opacity="0.7" filter="url(#blur)"/>'
		+ suckers(pts, ws))


# Два крупных щупальца обвивают шар навстречу друг другу, третье поменьше лезет
# снизу; кончики подвёрнуты внутрь, центр остаётся тёмным — под ник.
TENTACLES = [
	([(-18, 176), (44, 216), (126, 218), (188, 186), (214, 142), (204, 110), (176, 102), (162, 120)], 62),
	([(266, 74), (196, 30), (114, 26), (58, 60), (42, 104), (60, 128), (84, 120), (90, 100)], 44),
	([(120, 268), (150, 214), (200, 196), (238, 206)], 26),
]


def infected_badge():
	body = ''.join(tentacle(way, w) for way, w in TENTACLES)
	return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
 <defs>
  <clipPath id="ball"><circle cx="{C}" cy="{C}" r="{R}"/></clipPath>
  <radialGradient id="skin" cx="36%" cy="28%" r="82%">
   <stop offset="0%" stop-color="#3c4413"/>
   <stop offset="45%" stop-color="#1b1f07"/>
   <stop offset="100%" stop-color="#060803"/>
  </radialGradient>
  <linearGradient id="tent" x1="0.1" y1="0" x2="0.6" y2="1">
   <stop offset="0%" stop-color="#8ea425"/>
   <stop offset="50%" stop-color="#586011"/>
   <stop offset="100%" stop-color="#2b3109"/>
  </linearGradient>
  <radialGradient id="veil" cx="50%" cy="50%" r="50%">
   <stop offset="0%" stop-color="#040502" stop-opacity="0.75"/>
   <stop offset="70%" stop-color="#040502" stop-opacity="0.2"/>
   <stop offset="100%" stop-color="#040502" stop-opacity="0"/>
  </radialGradient>
  <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>
  <filter id="drop" x="-40%" y="-40%" width="180%" height="180%">
   <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.7"/>
  </filter>
 </defs>
 <circle cx="{C}" cy="{C}" r="{R}" fill="url(#skin)"/>
 <g clip-path="url(#ball)">
  <circle cx="{C}" cy="{C}" r="{R * 0.6:.1f}" fill="url(#veil)"/>
  <g filter="url(#drop)">{body}</g>
 </g>
 <circle cx="{C}" cy="{C}" r="{R - 1}" fill="none" stroke="#a8bf37" stroke-opacity="0.45" stroke-width="3"/>
 <circle cx="{C}" cy="{C}" r="{R + 1}" fill="none" stroke="#0e1103" stroke-width="5"/>
</svg>'''


def render(path, svg, size=S):
	svg_path = os.path.join(TMP, os.path.basename(path).replace('.png', '.svg'))
	with open(svg_path, 'w') as f:
		f.write(svg)
	subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), svg_path, '-o', path], check=True)
	return path


if __name__ == '__main__':
	TMP = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
	print(render(os.path.join(BADGES, 'thing.png'), thing_badge()))
	print(render(os.path.join(BADGES, 'infected.png'), infected_badge()))
