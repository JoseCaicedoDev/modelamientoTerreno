"""Genera dist/terrain-data.js a partir del DEM y de la textura satelital.

    python scripts/build_satellite_texture.py   # primero, si cambió la malla
    python scripts/build_terrain_data.py

El área de estudio y la malla se definen en terrain_grid.py, que comparte con el generador de la
textura para que ambos productos queden alineados celda a celda.
"""

import json

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, gaussian_filter
from shapely import contains_xy

from terrain_grid import (
    BUFFER_METERS,
    DEM,
    PROJECT,
    STEP,
    axes,
    crop_bounds,
    geotiff,
    study_area,
)

OUT = PROJECT / "dist" / "terrain-data.js"
SATELLITE = PROJECT / "dist" / "assets" / "satellite-texture.jpg"

boundary, area, area_wgs84 = study_area()
dem, pixel_x, pixel_y, origin_x, origin_y, nodata = geotiff(DEM)
first_row, last_row, first_column, last_column = crop_bounds(
    area, pixel_x, pixel_y, origin_x, origin_y, dem.shape
)
z = dem[first_row:last_row, first_column:last_column]

# Los huecos del DEM se rellenan con el valor válido más cercano y se suaviza el escalonado.
valid = z != nodata
nearest = distance_transform_edt(~valid, return_distances=False, return_indices=True)
z = gaussian_filter(z[tuple(nearest)], 1)

xs = origin_x + (np.arange(first_column, last_column) + 0.5) * pixel_x
ys = origin_y - (np.arange(first_row, last_row) + 0.5) * pixel_y
X, Y = np.meshgrid(xs, ys)
inside = contains_xy(area, X, Y)

# Submuestreo: rotación fluida en móvil sin perder el detalle real del origen.
z = z[::STEP, ::STEP]
inside = inside[::STEP, ::STEP]
xs, ys = axes(first_row, last_row, first_column, last_column, pixel_x, pixel_y, origin_x, origin_y)

z_out = []
for row_z, row_mask in zip(z, inside):
    z_out.append([round(float(v), 1) if keep else None for v, keep in zip(row_z, row_mask)])

x_utm = [round(float(x), 3) for x in xs]
y_utm = [round(float(y), 3) for y in ys]
values = z[inside]
satellite = np.asarray(Image.open(SATELLITE).convert("RGB"))
expected_size = (len(ys), len(xs), 3)
if satellite.shape != expected_size:
    raise ValueError(
        f"La textura satelital {satellite.shape} no coincide con la malla {expected_size}. "
        "Ejecuta scripts/build_satellite_texture.py antes que este script."
    )
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
    "bufferMeters": BUFFER_METERS,
    "boundary": [[round(lat, 8), round(lon, 8)] for lon, lat in boundary.exterior.coords],
    "buffer": [[round(lat, 8), round(lon, 8)] for lon, lat in area_wgs84.exterior.coords],
}
OUT.write_text("window.TERRAIN_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"{OUT} ({OUT.stat().st_size} bytes, {len(y_utm)}x{len(x_utm)} celdas, buffer {BUFFER_METERS} m)")
