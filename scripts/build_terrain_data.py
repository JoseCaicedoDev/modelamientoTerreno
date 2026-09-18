from pathlib import Path
import json

import numpy as np
import tifffile
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter
from shapely import contains_xy
from shapely.geometry import Polygon
from shapely.ops import transform
from pyproj import Transformer

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parent
DEM = ROOT / "ALOS_PALSAR" / "AP_27468_PLR_F0160_RT1" / "AP_27468_PLR_F0160_RT1.dem.tif"
OUT = PROJECT / "dist" / "terrain-data.js"
SATELLITE = PROJECT / "dist" / "assets" / "satellite-texture.jpg"

COORDS = [
    (-63.42829165563067, 8.226326478478772),
    (-63.454478505244, 8.223544607534595),
    (-63.45287913369275, 8.200374429668637),
    (-63.42807181107277, 8.211912547418001),
]


def geotiff(path):
    with tifffile.TiffFile(path) as tf:
        page = tf.pages[0]
        arr = page.asarray().astype(float)
        scale = page.tags["ModelPixelScaleTag"].value
        tie = page.tags["ModelTiepointTag"].value
        nodata = float(page.tags["GDAL_NODATA"].value)
    return arr, float(scale[0]), float(scale[1]), float(tie[3]), float(tie[4]), nodata


to_utm = Transformer.from_crs(4326, 32620, always_xy=True).transform
to_wgs84 = Transformer.from_crs(32620, 4326, always_xy=True).transform
area = transform(to_utm, Polygon(COORDS)).buffer(200)
area_wgs84 = transform(to_wgs84, area)
dem, px, py, x0, y0, nodata = geotiff(DEM)
minx, miny, maxx, maxy = area.bounds
c0 = max(0, int(np.floor((minx - x0) / px)) - 2)
c1 = min(dem.shape[1], int(np.ceil((maxx - x0) / px)) + 3)
r0 = max(0, int(np.floor((y0 - maxy) / py)) - 2)
r1 = min(dem.shape[0], int(np.ceil((y0 - miny) / py)) + 3)
z = dem[r0:r1, c0:c1]
valid = z != nodata
nearest = distance_transform_edt(~valid, return_distances=False, return_indices=True)
z = gaussian_filter(z[tuple(nearest)], 1)

xs = x0 + (np.arange(c0, c1) + 0.5) * px
ys = y0 - (np.arange(r0, r1) + 0.5) * py
X, Y = np.meshgrid(xs, ys)
inside = contains_xy(area, X, Y)

# About 135x136 cells: smooth rotation on mobile without losing the 30 m source detail.
step = 2
z = z[::step, ::step]
inside = inside[::step, ::step]
xs = xs[::step]
ys = ys[::step]

z_out = []
for row_z, row_mask in zip(z, inside):
    z_out.append([round(float(v), 1) if keep else None for v, keep in zip(row_z, row_mask)])

x_utm = [round(float(x), 3) for x in xs]
y_utm = [round(float(y), 3) for y in ys]
values = z[inside]
satellite = np.asarray(Image.open(SATELLITE).convert("RGB"))
expected_size = (len(ys), len(xs), 3)
if satellite.shape != expected_size:
    raise ValueError(f"Satellite texture shape {satellite.shape} does not match terrain grid {expected_size}")
satellite_colors = [
    [f"#{r:02x}{g:02x}{b:02x}" if keep else None for (r, g, b), keep in zip(row_rgb, row_mask)]
    for row_rgb, row_mask in zip(satellite, inside)
]
payload = {
    "x": x_utm,
    "y": y_utm,
    "z": z_out,
    "satellite": satellite_colors,
    "minElevation": 0,
    "maxElevation": 55,
    "actualMinElevation": round(float(values.min()), 1),
    "actualMaxElevation": round(float(values.max()), 1),
    "aspectY": round(float((ys[0] - ys[-1]) / (xs[-1] - xs[0])), 4),
    "crs": "EPSG:32620",
    "source": "SRTMGL1 / ALOS PALSAR RTC ALPSRP274680160",
    "boundary": [[round(lat, 8), round(lon, 8)] for lon, lat in Polygon(COORDS).exterior.coords],
    "buffer": [[round(lat, 8), round(lon, 8)] for lon, lat in area_wgs84.exterior.coords]
}
OUT.write_text("window.TERRAIN_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"{OUT} ({OUT.stat().st_size} bytes, {len(y_utm)}x{len(x_utm)} cells)")
