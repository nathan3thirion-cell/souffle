# Fabrique les trois cartes de texture des poumons (assets/lungs-*.png).
# Lancé une seule fois au moment de construire l'appli ; le téléphone ne fait que les lire.
#
#   lungs-a.png  R,G = normale XY    B = hauteur
#   lungs-b.png  R = masque poumons  G = voies aériennes  B = distance depuis la trachée
#   lungs-c.png  R = bords des lobules  G = goudron (ordre de nettoyage)  B = capillaires
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

W, H = 768, 844
VIEW_W, VIEW_H = 1000, 1100
S = W / VIEW_W
SS = 2  # suréchantillonnage des formes
random.seed(996)
rng = np.random.default_rng(996)
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "assets"


def catmull(points, closed=True, steps=20):
    pts = list(points)
    n = len(pts)
    out = []
    rng_i = range(n) if closed else range(n - 1)
    for i in rng_i:
        if closed:
            p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        else:
            p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
        for k in range(steps):
            t = k / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    if not closed:
        out.append(pts[-1])
    return out


def raster(poly, soft=True):
    im = Image.new("L", (W * SS, H * SS), 0)
    ImageDraw.Draw(im).polygon([(x * S * SS, y * S * SS) for x, y in poly], fill=255)
    if soft:
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def gaussian_noise(sigma, seed_shift=0):
    n = rng.standard_normal((H, W))
    n = ndi.gaussian_filter(n, sigma, mode="reflect")
    return (n - n.mean()) / (n.std() + 1e-6)


def fbm(base_sigma, octaves=4):
    total = np.zeros((H, W), np.float32)
    amp, sigma, norm = 1.0, base_sigma, 0.0
    for _ in range(octaves):
        total += amp * gaussian_noise(sigma)
        norm += amp
        amp *= 0.55
        sigma *= 0.5
    return total / norm


def pillow(mask, radius):
    """Bombé arrondi : profil de quart de cercle à partir du bord."""
    d = ndi.distance_transform_edt(mask > 0.5)
    t = np.clip(d / radius, 0, 1)
    return np.sqrt(1 - (1 - t) ** 2)


# --- silhouettes (repère 1000 x 1100, poumon droit du patient à gauche de l'image) ---
RIGHT = catmull([
    (374, 136), (318, 150), (254, 216), (196, 320), (150, 440), (118, 565), (96, 695), (82, 815), (92, 902),
    (130, 936), (190, 925), (262, 892), (336, 872), (404, 882), (448, 914), (476, 890), (482, 820),
    (470, 715), (452, 620), (432, 535), (442, 450), (446, 360), (432, 258), (408, 166),
])
LEFT = catmull([
    (628, 144), (594, 170), (574, 262), (562, 360), (560, 450), (570, 530), (600, 600), (648, 655), (676, 722),
    (660, 786), (622, 838), (604, 885), (632, 906), (700, 878), (776, 868), (852, 890), (906, 926), (940, 900),
    (934, 800), (920, 690), (890, 560), (850, 440), (798, 325), (738, 216), (680, 152),
])
# Fissures : scissures qui séparent les lobes (3 à droite, 2 à gauche)
R_OBLIQUE = catmull([(60, 492), (150, 548), (246, 660), (330, 790), (392, 960)], closed=False)
R_HORIZ = catmull([(186, 575), (280, 548), (372, 530), (520, 520)], closed=False)
L_OBLIQUE = catmull([(960, 400), (860, 470), (770, 590), (690, 730), (610, 960)], closed=False)

right_mask = raster(RIGHT)
left_mask = raster(LEFT)
lung_mask = np.maximum(right_mask, left_mask)


def side_region(curve, extra):
    return raster(list(curve) + extra)


# Lobes droits
r_below_oblique = side_region(R_OBLIQUE, [(392, 1200), (-50, 1200), (-50, 492)])
r_above_horiz = side_region(R_HORIZ, [(520, -50), (-50, -50), (-50, 492), (60, 492), (150, 548)])
r_upper = right_mask * r_above_horiz * (1 - r_below_oblique)
r_lower = right_mask * r_below_oblique
r_middle = np.clip(right_mask - r_upper - r_lower, 0, 1)
# Lobes gauches
l_lower = left_mask * side_region(L_OBLIQUE, [(610, 1200), (1050, 1200), (1050, 400)])
l_upper = np.clip(left_mask - l_lower, 0, 1)
lobes = [r_upper, r_middle, r_lower, l_upper, l_lower]

whole_dome = pillow(lung_mask, 210 * S)
lobe_dome = ndi.gaussian_filter(np.max([pillow(l, 62 * S) for l in lobes], axis=0), 2.2)
fissure_core = np.zeros((H, W), np.float32)
for curve in (R_OBLIQUE, R_HORIZ, L_OBLIQUE):
    im = Image.new("L", (W * SS, H * SS), 0)
    ImageDraw.Draw(im).line([(x * S * SS, y * S * SS) for x, y in curve], fill=255, width=int(3 * S * SS) + 1)
    fissure_core = np.maximum(fissure_core, np.asarray(im.resize((W, H), Image.LANCZOS), np.float32) / 255)
fissure_core *= lung_mask

# --- lobules : mailles polygonales qui se voient en surface d'un vrai poumon ---
warp_x = fbm(26, 3) * 8
warp_y = fbm(26, 3) * 8
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
pts = []
step = 15.0
for iy in range(int(H / step) + 2):
    for ix in range(int(W / step) + 2):
        pts.append(((ix + 0.5 * (iy % 2) + rng.uniform(-0.38, 0.38)) * step, (iy + rng.uniform(-0.38, 0.38)) * step))
pts = np.array(pts)
tree = cKDTree(pts)
query = np.stack([(xx + warp_x).ravel(), (yy + warp_y).ravel()], 1)
dists, ids = tree.query(query, k=2)
border = (dists[:, 1] - dists[:, 0]).reshape(H, W)
cell_id = ids[:, 0].reshape(H, W)
cell_rand = rng.random(len(pts))[cell_id]
lobule_edge = np.clip(1 - border / 2.4, 0, 1) ** 1.3
lobule_bump = np.clip(border / 6.0, 0, 1)
# Mailles plus fines par endroits, moins régulières
lobule_edge *= np.clip(0.55 + 0.45 * fbm(40, 2), 0.15, 1)

# --- voies aériennes : arbre bronchique généré par branchements ---
tube = Image.new("L", (W * SS, H * SS), 0)
tube_draw = ImageDraw.Draw(tube)
path_img = np.full((H, W), -1.0, np.float32)
segments = []


def inside(x, y):
    ix, iy = int(x * S), int(y * S)
    return 0 <= ix < W and 0 <= iy < H and lung_mask[iy, ix] > 0.5


def grow(x, y, angle, length, width, gen, travelled):
    if gen > 8 or length < 13 or width < 1.2:
        return
    pts_seg = [(x, y)]
    a = angle
    n = 6
    px, py = x, y
    for i in range(n):
        a += random.uniform(-0.09, 0.09)
        nx, ny = px + math.cos(a) * length / n, py + math.sin(a) * length / n
        if gen > 2 and not inside(nx, ny):
            break
        pts_seg.append((nx, ny))
        px, py = nx, ny
    if len(pts_seg) < 3:
        return
    segments.append((pts_seg, width, travelled, travelled + length))
    if gen >= 8:
        return
    spread = random.uniform(0.40, 0.66)
    bias = random.uniform(-0.12, 0.12)
    ratio = random.uniform(0.40, 0.60)
    w1 = width * (0.84 - 0.08 * ratio)
    w2 = width * (0.66 + 0.08 * ratio)
    grow(px, py, a - spread * ratio + bias, length * random.uniform(0.76, 0.9), w1, gen + 1, travelled + length)
    grow(px, py, a + spread * (1 - ratio) + bias, length * random.uniform(0.66, 0.84), w2, gen + 1, travelled + length)


TRACHEA_TOP = (500, 8)
CARINA = (500, 300)
# Tronc droit : plus court et plus vertical. Tronc gauche : plus long et plus horizontal.
R_MAIN_END = (438, 408)
L_MAIN_END = (582, 402)
segments.append(([TRACHEA_TOP, CARINA], 28, 0, 292))
segments.append((catmull([CARINA, (470, 345), R_MAIN_END], closed=False, steps=6), 20, 292, 410))
segments.append((catmull([CARINA, (540, 340), L_MAIN_END], closed=False, steps=6), 19, 292, 420))
# Bronches lobaires
grow(R_MAIN_END[0], R_MAIN_END[1], math.radians(205), 104, 11, 2, 410)   # lobe supérieur droit
grow(R_MAIN_END[0], R_MAIN_END[1], math.radians(150), 118, 11, 2, 410)   # lobe moyen droit
grow(R_MAIN_END[0], R_MAIN_END[1], math.radians(105), 134, 13, 2, 410)   # lobe inférieur droit
grow(L_MAIN_END[0], L_MAIN_END[1], math.radians(-25), 112, 11, 2, 420)   # lobe supérieur gauche
grow(L_MAIN_END[0], L_MAIN_END[1], math.radians(38), 116, 12, 2, 420)    # lingula
grow(L_MAIN_END[0], L_MAIN_END[1], math.radians(72), 148, 13, 2, 420)    # lobe inférieur gauche

segments.sort(key=lambda s: -s[1])
max_path = max(s[3] for s in segments)
path_canvas = Image.new("F", (W, H), -1.0)
path_draw = ImageDraw.Draw(path_canvas)
for seg, width, d0, d1 in segments:
    scaled = [(x * S * SS, y * S * SS) for x, y in seg]
    w_px = max(1, int(round(width * S * SS)))
    tube_draw.line(scaled, fill=255, width=w_px, joint="curve")
    for (x, y) in scaled[::1]:
        r = w_px / 2
        tube_draw.ellipse((x - r, y - r, x + r, y + r), fill=255)
    for k in range(len(seg) - 1):
        d = d0 + (d1 - d0) * k / max(1, len(seg) - 1)
        a = (seg[k][0] * S, seg[k][1] * S)
        b = (seg[k + 1][0] * S, seg[k + 1][1] * S)
        path_draw.line([a, b], fill=float(d), width=max(1, int(width * S)))
tube_mask = np.asarray(tube.resize((W, H), Image.LANCZOS), np.float32) / 255
# Les fines bronches restent sous la plèvre : rien ne dépasse de la silhouette,
# sauf la trachée et les deux troncs au-dessus du hile.
under_pleura = np.clip(ndi.distance_transform_edt(lung_mask > 0.5) / (10 * S), 0, 1)
above_hilum = np.clip((430 * S - yy) / 10, 0, 1) * np.clip(1 - lung_mask * 1.0, 0, 1)
tube_mask = tube_mask * np.maximum(under_pleura, above_hilum)
path_arr = np.asarray(path_canvas, np.float32)
_, (iy_near, ix_near) = ndi.distance_transform_edt(path_arr < 0, return_indices=True)
near_dist = ndi.distance_transform_edt(path_arr < 0)
airway_dist = path_arr[iy_near, ix_near] + near_dist / S * 0.7
airway_dist = np.clip(airway_dist / (max_path + 90), 0, 1)
# Lissage large : l'air et la fumée doivent diffuser dans le tissu sans bord visible
airway_dist = ndi.gaussian_filter(airway_dist, 18.0)

tube_round = pillow(tube_mask, 12 * S)
# Anneaux de cartilage de la trachée et des gros troncs
rings = 0.5 + 0.5 * np.sin(yy / (15 * S) * 2 * math.pi)
trachea_zone = np.clip((CARINA[1] * S + 8 - yy) / 12, 0, 1) * tube_mask
tube_h = tube_round * (0.88 + 0.12 * rings * trachea_zone)

# --- hauteur finale, normale ---
fine = fbm(5, 3)
broad = fbm(44, 3)
height = lung_mask * (0.56 * whole_dome + 0.40 * lobe_dome + 0.026 * broad + 0.013 * lobule_bump + 0.004 * fine)
height -= fissure_core * 0.11
outside_lung = 1 - lung_mask
height_total = height + outside_lung * tube_h * 0.62
# Les bronches soulèvent à peine la surface : elles sont dessous, on les devine
inner_tube = lung_mask * ndi.gaussian_filter(tube_mask, 1.2)
height_total += inner_tube * 0.005
height_total = ndi.gaussian_filter(height_total, 0.8)

gx = ndi.sobel(height_total, axis=1, mode="nearest") / 8.0
gy = ndi.sobel(height_total, axis=0, mode="nearest") / 8.0
strength = 26.0
nx, ny = -gx * strength, -gy * strength
nz = np.ones_like(nx)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
nx, ny = nx / ln, ny / ln

# --- goudron : champ égalisé en rang, donc « seuil = part de surface encore tachée » ---
upper_bias = np.clip(1.15 - yy / (H * 0.78), 0, 1)  # les atteintes du fumeur prédominent en haut des poumons
n_macro = fbm(30, 4)
n_micro = fbm(5, 3)
tar_raw = (
    0.62 * n_macro
    + 0.30 * (cell_rand - 0.5) * 2.0
    + 0.30 * n_micro
    + 0.62 * upper_bias
    + 0.42 * lobule_edge * 2.0
)
tar_raw = ndi.gaussian_filter(tar_raw, 1.1)
inside_px = lung_mask > 0.5
ranks = np.zeros_like(tar_raw)
order = np.argsort(tar_raw[inside_px], kind="mergesort")
vals = np.zeros(order.size, np.float32)
vals[order] = np.linspace(0, 1, order.size)
ranks[inside_px] = vals
ranks = ndi.gaussian_filter(ranks, 0.7)

# --- capillaires ---
ridged = 1 - np.abs(np.clip(fbm(16, 4) * 0.8, -1, 1))
caps = np.clip((ridged - 0.72) / 0.28, 0, 1) ** 1.7
caps = caps * (0.55 + 0.45 * np.clip(fbm(50, 2) + 0.5, 0, 1))
mask_all = np.maximum(lung_mask, tube_mask)
height_out = np.clip(height_total, 0, 1)


def to8(a):
    return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


a_png = np.dstack([to8(nx * 0.5 + 0.5), to8(ny * 0.5 + 0.5), to8(height_out)])
b_png = np.dstack([to8(lung_mask), to8(tube_mask), to8(airway_dist)])
c_png = np.dstack([to8(lobule_edge * lung_mask), to8(ranks), to8(caps * lung_mask)])
OUT.mkdir(parents=True, exist_ok=True)
for name, arr in (("lungs-a.png", a_png), ("lungs-b.png", b_png), ("lungs-c.png", c_png)):
    Image.fromarray(arr, "RGB").save(OUT / name, optimize=True)
    print(name, (OUT / name).stat().st_size // 1024, "Ko")
print("segments", len(segments))
