"""
Malaysia's states as OpenStreetMap has them today, cut to the land the basemap draws
(2026-10-01). The input `buildMalaysiaStates.mjs` turns into the map's files.

## Why

The states used to come from geoBoundaries, which is OSM as it stood in 2017. CARTO's
basemap is OSM as it stands now, so the two disagreed by 130 m on average and 850 m at
worst, and the old coast cut across Penang's reclaimed land. This takes the state
relations from OSM itself (Overpass) and the coast from OSM's land polygons
(osmdata.openstreetmap.de, rebuilt daily), which are what the basemap's own sea is cut
from.

## Why the land polygons

About half of Malaysia's state relations reach out to sea: Selangor's runs 47 km into
the Strait of Malacca, Sabah's nearly 200 km. Those edges are maritime limits, not a
shore, so every state is cut to the land polygons. What is left meets the sea where the
basemap does.

And the land polygons inside Malaysia's national boundary that no state relation
reaches go to the nearest state: islands such as Pulau Aur, Pulau Jarak and
Layang-Layang, and slivers where a relation drawn along its own coastline ways stops
short of the land polygons. Without them those shores went unlined, because the map
only lines a shore near a state's outline.

## Output, into <out-dir>

| file | holds |
| --- | --- |
| `osm-MYS-ADM1.geojson` | the 16 states, shaped like geoBoundaries' file (`shapeISO`, `shapeName`) |
| `malaysia-land-border.geojson` | Malaysia's land borders, the non-maritime ways of relation 2108121 |
| `neighbours-land.geojson` | the other countries' land within 7 km of Malaysia, from the same land polygons |

## Running it

  python3 -m venv venv && ./venv/bin/pip install shapely pyshp
  curl -O https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip   # 930 MB
  unzip land-polygons-split-4326.zip
  ./venv/bin/python src/lib/geo/fetchOsmStates.py land-polygons-split-4326/land_polygons.shp <out-dir>
  node src/lib/geo/buildMalaysiaStates.mjs <out-dir>

Overpass answers are kept in `<out-dir>/overpass/` and reused on a rerun, since the
public server often refuses with 429 or 504; delete the folder for a fresh fetch.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

import shapefile
from shapely import STRtree
from shapely.geometry import LineString, MultiPolygon, Polygon, box, mapping, shape
from shapely.ops import polygonize, unary_union

OVERPASS = 'https://overpass-api.de/api/interpreter'
MALAYSIA = 2108121
REGION = box(98.5, -0.2, 120.5, 8.5)
NEIGHBOUR_REACH = 0.07  # degrees, ~7 km
#: A leftover piece this much nearer one state than any other is that state's whole.
SHARE_MARGIN = 0.002  # ~200 m
#: How a piece near two states is shared: both grow by these, in turn, nearest first.
SHARE_STEPS = [0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.05, 0.2, 1.0, 5.0]


def overpass(cache, name, query):
    path = os.path.join(cache, f'{name}.json')
    if os.path.exists(path):
        with open(path) as file:
            return json.load(file)
    url = OVERPASS + '?' + urllib.parse.urlencode({'data': f'[out:json][timeout:600];{query}'})
    for attempt in range(6):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'gensetiq'})
            with urllib.request.urlopen(request, timeout=900) as response:
                answer = json.load(response)
            with open(path, 'w') as file:
                json.dump(answer, file)
            return answer
        except Exception as error:  # Overpass answers a busy server with HTML.
            print(f'  overpass busy ({error}), retrying', file=sys.stderr)
            time.sleep(15 * (attempt + 1))
    raise SystemExit('overpass kept refusing; rerun later, answers so far are kept')


def line(way):
    return LineString([(point['lon'], point['lat']) for point in way['geometry']])


def state_shape(relation):
    rings = {'outer': [], 'inner': []}
    for member in relation['members']:
        if member['type'] == 'way' and 'geometry' in member:
            rings['inner' if member['role'] == 'inner' else 'outer'].append(line(member))
    area = unary_union(list(polygonize(rings['outer'])))
    return area.difference(unary_union(list(polygonize(rings['inner'])))) if rings['inner'] else area


def polygons(geometry):
    if geometry.is_empty:
        return []
    if isinstance(geometry, Polygon):
        return [geometry]
    if isinstance(geometry, MultiPolygon):
        return list(geometry.geoms)
    return [part for each in geometry.geoms for part in polygons(each)]


def write(path, collection):
    with open(path, 'w') as file:
        json.dump(collection, file)
    print(f'{os.path.basename(path)}: {os.path.getsize(path) // 1024} KB')


def main(land_path, out_dir):
    cache = os.path.join(out_dir, 'overpass')
    os.makedirs(cache, exist_ok=True)

    print('land polygons ...')
    # The bbox filter skips the rest of the world without reading its points.
    land = [shape(record.__geo_interface__)
            for record in shapefile.Reader(land_path).iterShapes(bbox=REGION.bounds)
            if record is not None]
    tree = STRtree(land)
    print(f'  {len(land)} pieces in the region')

    listing = overpass(cache, 'states', 'rel["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^MY-"];out tags;')
    print(f'states as of {listing["osm3s"]["timestamp_osm_base"]}')
    # Malaysia's land: every land polygon inside the national boundary, territorial
    # waters and all. Each state gets its relation's share of it, and then the rest.
    ways = overpass(cache, 'country', f'rel({MALAYSIA});way(r);out tags geom;')['elements']
    country = unary_union(list(polygonize([line(way) for way in ways])))
    malaysian = unary_union([land[i] for i in tree.query(country)]).intersection(country)

    names, cuts = {}, {}
    for element in sorted(listing['elements'], key=lambda each: each['tags']['ISO3166-2']):
        iso = element['tags']['ISO3166-2']
        names[iso] = element['tags'].get('name:en', element['tags']['name'])
        relation = overpass(cache, f'rel-{element["id"]}', f'rel({element["id"]});out geom;')['elements'][0]
        cuts[iso] = state_shape(relation).buffer(0).intersection(malaysian)

    # The rest: islands no state relation reaches (Pulau Aur, Pulau Jarak, Layang-Layang)
    # and slivers where a relation drawn along its own coastline ways stops short of
    # the land polygons. Each goes to the nearest state, or, where two are near, is
    # shared out by growing both in small steps so the split lands on their border.
    rest = polygons(malaysian.difference(unary_union(list(cuts.values()))))
    parts = [(iso, part) for iso, cut in cuts.items() for part in polygons(cut)]
    part_tree = STRtree([part for _, part in parts])
    extra = {iso: [] for iso in cuts}
    for piece in rest:
        if piece.area < 1e-10:
            continue
        nearest = min(parts[i][1].distance(piece) for i in part_tree.query_nearest(piece, all_matches=True))
        near = {}
        for i in part_tree.query(piece.buffer(nearest + SHARE_MARGIN)):
            iso, part = parts[i]
            near.setdefault(iso, []).append(part)
        if len(near) == 1:
            extra[next(iter(near))].append(piece)
            continue
        left = piece
        for step in SHARE_STEPS:
            for iso, near_parts in near.items():
                take = left.intersection(unary_union(near_parts).buffer(step))
                if not take.is_empty:
                    extra[iso].append(take)
                    left = left.difference(take)
            if left.is_empty:
                break

    features = []
    for iso, cut in cuts.items():
        whole = MultiPolygon(polygons(unary_union([cut, *extra[iso]])))
        print(f'  {iso} {names[iso]}: {len(whole.geoms)} parts, {len(extra[iso])} added')
        features.append({
            'type': 'Feature',
            'properties': {'shapeISO': iso, 'shapeName': names[iso]},
            'geometry': mapping(whole),
        })
    write(os.path.join(out_dir, 'osm-MYS-ADM1.geojson'), {'type': 'FeatureCollection', 'features': features})

    write(os.path.join(out_dir, 'malaysia-land-border.geojson'), {
        'type': 'FeatureCollection',
        'features': [{
            'type': 'Feature',
            'properties': {'id': way['id']},
            'geometry': mapping(line(way)),
        } for way in ways if way.get('tags', {}).get('maritime') != 'yes'],
    })

    # The other countries' land near Malaysia, so coastline.ts can tell whose shore is
    # whose. Taken as the land outside Malaysia's national boundary, territorial waters
    # and all, not outside the states: a state relation drawn along its own coastline
    # ways misses slivers of the land polygons, and a sliver filed as a neighbour hid
    # stretches of Tioman's shore.
    malaysia = unary_union([shape(feature['geometry']) for feature in features])
    reach = malaysia.buffer(NEIGHBOUR_REACH)
    others = unary_union([land[i] for i in tree.query(reach)]).intersection(reach).difference(country)
    write(os.path.join(out_dir, 'neighbours-land.geojson'), {
        'type': 'FeatureCollection',
        'features': [{'type': 'Feature', 'properties': {}, 'geometry': mapping(part)}
                     for part in polygons(others) if part.area > 1e-8],
    })


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: fetchOsmStates.py <land_polygons.shp> <out-dir>')
    main(sys.argv[1], sys.argv[2])
