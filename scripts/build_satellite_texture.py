"""Genera la textura satelital que se drapea sobre el modelo 3D.

Descarga las teselas de Esri World Imagery que cubren la zona de influencia y las remuestrea a la
misma malla que publica build_terrain_data.py: un píxel por celda del DEM. El resultado se guarda
en dist/assets/satellite-texture.jpg, que build_terrain_data.py consume y valida.

    python scripts/build_satellite_texture.py

Las imágenes son © Esri, Maxar, Earthstar Geographics y GIS User Community; el visor mantiene esa
atribución visible tanto en el mapa como en el pie del modelo.
"""

from urllib.request import Request, urlopen
import io
import math

import numpy as np
from PIL import Image
from pyproj import Transformer

from terrain_grid import PIXEL_STEP_METERS, PROJECT, grid_axes

OUT = PROJECT / "dist" / "assets" / "satellite-texture.jpg"
CACHE = PROJECT.parent / "tmp" / "teselas"
TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
USER_AGENT = "GestiagroTerrainViewer/1.0 (generacion de textura del modelo 3D)"
TILE_SIZE = 256
ZOOM = 16

to_wgs84 = Transformer.from_crs(32620, 4326, always_xy=True)


def tile(x, y, z):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{z}_{x}_{y}.jpg"
    if not path.exists():
        request = Request(TILE_URL.format(z=z, x=x, y=y), headers={"User-Agent": USER_AGENT})
        with urlopen(request, timeout=30) as response:
            path.write_bytes(response.read())
    return np.asarray(Image.open(io.BytesIO(path.read_bytes())).convert("RGB"))


def mosaic(min_lon, min_lat, max_lon, max_lat, zoom):
    """Descarga las teselas que cubren el recuadro y las une en un solo arreglo."""
    scale = TILE_SIZE * 2 ** zoom

    def to_global_pixels(longitude, latitude):
        x = (longitude + 180.0) / 360.0 * scale
        sin_lat = math.sin(math.radians(latitude))
        y = (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * scale
        return x, y

    left, top = to_global_pixels(min_lon, max_lat)
    right, bottom = to_global_pixels(max_lon, min_lat)
    first_tile_x = int(left // TILE_SIZE)
    last_tile_x = int(right // TILE_SIZE)
    first_tile_y = int(top // TILE_SIZE)
    last_tile_y = int(bottom // TILE_SIZE)

    columns = last_tile_x - first_tile_x + 1
    rows = last_tile_y - first_tile_y + 1
    canvas = np.zeros((rows * TILE_SIZE, columns * TILE_SIZE, 3), dtype=np.uint8)
    for row in range(rows):
        for column in range(columns):
            canvas[
                row * TILE_SIZE:(row + 1) * TILE_SIZE,
                column * TILE_SIZE:(column + 1) * TILE_SIZE,
            ] = tile(first_tile_x + column, first_tile_y + row, zoom)
    print(f"{columns * rows} teselas descargadas o reutilizadas en zoom {zoom}")
    return canvas, first_tile_x * TILE_SIZE, first_tile_y * TILE_SIZE, to_global_pixels


def build():
    xs, ys = grid_axes()
    grid_x, grid_y = np.meshgrid(xs, ys)
    longitudes, latitudes = to_wgs84.transform(grid_x, grid_y)

    margin = 0.002
    canvas, offset_x, offset_y, to_global_pixels = mosaic(
        longitudes.min() - margin,
        latitudes.min() - margin,
        longitudes.max() + margin,
        latitudes.max() + margin,
        ZOOM,
    )

    # Cada celda de 25 m abarca varios píxeles de la tesela: se promedian para no quedarse
    # con el píxel del centro, que introduce ruido y aliasing en el modelo.
    half = PIXEL_STEP_METERS / 2
    texture = np.zeros((len(ys), len(xs), 3), dtype=np.uint8)
    corners_x, corners_y = to_wgs84.transform(
        np.stack([grid_x - half, grid_x + half]),
        np.stack([grid_y + half, grid_y - half]),
    )
    for row in range(len(ys)):
        for column in range(len(xs)):
            left, top = to_global_pixels(corners_x[0, row, column], corners_y[0, row, column])
            right, bottom = to_global_pixels(corners_x[1, row, column], corners_y[1, row, column])
            x0 = max(0, int(round(left - offset_x)))
            x1 = min(canvas.shape[1], max(x0 + 1, int(round(right - offset_x))))
            y0 = max(0, int(round(top - offset_y)))
            y1 = min(canvas.shape[0], max(y0 + 1, int(round(bottom - offset_y))))
            texture[row, column] = canvas[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(texture).save(OUT, quality=88)
    print(f"{OUT} ({OUT.stat().st_size} bytes, {texture.shape[1]}x{texture.shape[0]} px)")


if __name__ == "__main__":
    build()
