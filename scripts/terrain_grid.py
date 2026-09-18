"""Definición compartida del área de estudio y de la malla del modelo.

La usan build_terrain_data.py y build_satellite_texture.py para que el DEM publicado y la textura
satelital se apoyen exactamente en la misma rejilla. Cambiar aquí el polígono, la zona de
influencia o el submuestreo obliga a regenerar ambos.
"""

from pathlib import Path

import numpy as np
import tifffile
from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.ops import transform

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parent
DEM = ROOT / "ALOS_PALSAR" / "AP_27468_PLR_F0160_RT1" / "AP_27468_PLR_F0160_RT1.dem.tif"

# Vértices del levantamiento preliminar, en WGS 84 geográficas.
COORDS = [
    (-63.42829165563067, 8.226326478478772),
    (-63.454478505244, 8.223544607534595),
    (-63.45287913369275, 8.200374429668637),
    (-63.42807181107277, 8.211912547418001),
]

# Zona de influencia alrededor del levantamiento.
BUFFER_METERS = 500

# Submuestreo de la malla del DEM: 2 deja celdas de 25 m a partir de los 12,5 m del producto RTC.
STEP = 2

# Tamaño real de la celda publicada, en metros.
PIXEL_STEP_METERS = 12.5 * STEP

UTM_20N = 32620
WGS84 = 4326

to_utm = Transformer.from_crs(WGS84, UTM_20N, always_xy=True).transform
to_wgs84 = Transformer.from_crs(UTM_20N, WGS84, always_xy=True).transform


def geotiff(path):
    """Arreglo y georreferencia de un GeoTIFF, leídos de las etiquetas TIFF."""
    with tifffile.TiffFile(path) as archivo:
        page = archivo.pages[0]
        array = page.asarray().astype(float)
        scale = page.tags["ModelPixelScaleTag"].value
        tie = page.tags["ModelTiepointTag"].value
        nodata = float(page.tags["GDAL_NODATA"].value)
    return array, float(scale[0]), float(scale[1]), float(tie[3]), float(tie[4]), nodata


def geotiff_reference(path):
    """Solo la georreferencia, sin cargar el arreglo completo en memoria."""
    with tifffile.TiffFile(path) as archivo:
        page = archivo.pages[0]
        scale = page.tags["ModelPixelScaleTag"].value
        tie = page.tags["ModelTiepointTag"].value
        return float(scale[0]), float(scale[1]), float(tie[3]), float(tie[4]), page.shape


def study_area():
    """Polígono de estudio y su zona de influencia, en UTM y en WGS 84."""
    boundary = Polygon(COORDS)
    area = transform(to_utm, boundary).buffer(BUFFER_METERS)
    return boundary, area, transform(to_wgs84, area)


def crop_bounds(area, pixel_x, pixel_y, origin_x, origin_y, shape):
    """Filas y columnas del DEM que cubren la zona de influencia, con dos celdas de margen."""
    minx, miny, maxx, maxy = area.bounds
    first_column = max(0, int(np.floor((minx - origin_x) / pixel_x)) - 2)
    last_column = min(shape[1], int(np.ceil((maxx - origin_x) / pixel_x)) + 3)
    first_row = max(0, int(np.floor((origin_y - maxy) / pixel_y)) - 2)
    last_row = min(shape[0], int(np.ceil((origin_y - miny) / pixel_y)) + 3)
    return first_row, last_row, first_column, last_column


def axes(first_row, last_row, first_column, last_column, pixel_x, pixel_y, origin_x, origin_y):
    """Centros de celda en UTM, ya submuestreados."""
    xs = origin_x + (np.arange(first_column, last_column) + 0.5) * pixel_x
    ys = origin_y - (np.arange(first_row, last_row) + 0.5) * pixel_y
    return xs[::STEP], ys[::STEP]


def grid_axes(path=DEM):
    """Ejes de la malla publicada, calculados solo con la georreferencia del DEM."""
    pixel_x, pixel_y, origin_x, origin_y, shape = geotiff_reference(path)
    bounds = crop_bounds(study_area()[1], pixel_x, pixel_y, origin_x, origin_y, shape)
    return axes(*bounds, pixel_x, pixel_y, origin_x, origin_y)
