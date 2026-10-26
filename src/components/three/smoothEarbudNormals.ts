import * as THREE from "three";

type Sample = { x: number; y: number; z: number; directions: number[] };

/** Owns its cloned geometry; only normals change, so UVs and silhouette stay intact. */
export function smoothEarbudNormals(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone();
  const position = geometry.getAttribute("position");
  if (!position?.count) return geometry;
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  if (!normal || normal.count !== position.count) return geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!(extent > 0) || !Number.isFinite(extent)) return geometry;

  const radius = extent * 0.015, radiusSquared = radius * radius;
  const epsilon = extent * 1e-6, minimumDot = Math.cos(Math.PI / 6);
  const width = Math.floor(size.x / radius) + 1;
  const height = Math.floor(size.y / radius) + 1;
  const depth = Math.floor(size.z / radius) + 1;
  const cellKey = (x: number, y: number, z: number) => x + width * (y + height * z);
  const cells = new Map<number, Sample[]>();
  const unique = new Map<string, Sample>();
  const original = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) || 1;
    const nx = normal.getX(i) / length, ny = normal.getY(i) / length, nz = normal.getZ(i) / length;
    original.set([nx, ny, nz], i * 3);
    const key = `${Math.round((x - box.min.x) / epsilon)},${Math.round((y - box.min.y) / epsilon)},${Math.round((z - box.min.z) / epsilon)}`;
    let sample = unique.get(key);
    if (!sample) {
      sample = { x, y, z, directions: [] };
      unique.set(key, sample);
      const cell = cellKey(Math.floor((x - box.min.x) / radius), Math.floor((y - box.min.y) / radius), Math.floor((z - box.min.z) / radius));
      const bucket = cells.get(cell);
      if (bucket) bucket.push(sample);
      else cells.set(cell, [sample]);
    }
    // Keep crease directions, but never give duplicate UV seam vertices extra weight.
    const directions = sample.directions;
    let duplicate = false;
    for (let j = 0; j < directions.length; j += 3) {
      if (nx * directions[j] + ny * directions[j + 1] + nz * directions[j + 2] > 0.999999) duplicate = true;
    }
    if (!duplicate) directions.push(nx, ny, nz);
  }

  const smoothed = original.slice();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = original[i * 3], ny = original[i * 3 + 1], nz = original[i * 3 + 2];
    const cx = Math.floor((x - box.min.x) / radius), cy = Math.floor((y - box.min.y) / radius), cz = Math.floor((z - box.min.z) / radius);
    let sx = 0, sy = 0, sz = 0;
    for (let dz = Math.max(0, cz - 1); dz <= Math.min(depth - 1, cz + 1); dz++) {
      for (let dy = Math.max(0, cy - 1); dy <= Math.min(height - 1, cy + 1); dy++) {
        for (let dx = Math.max(0, cx - 1); dx <= Math.min(width - 1, cx + 1); dx++) {
          for (const sample of cells.get(cellKey(dx, dy, dz)) ?? []) {
            const distanceSquared = (x - sample.x) ** 2 + (y - sample.y) ** 2 + (z - sample.z) ** 2;
            if (distanceSquared >= radiusSquared) continue;
            const directions = sample.directions;
            let best = -1, bestDot = minimumDot;
            for (let j = 0; j < directions.length; j += 3) {
              const dot = nx * directions[j] + ny * directions[j + 1] + nz * directions[j + 2];
              if (dot >= bestDot) { best = j; bestDot = dot; }
            }
            if (best < 0) continue;
            const weight = (1 - distanceSquared / radiusSquared) ** 2;
            sx += directions[best] * weight;
            sy += directions[best + 1] * weight;
            sz += directions[best + 2] * weight;
          }
        }
      }
    }
    const length = Math.hypot(sx, sy, sz);
    if (length > 0) smoothed.set([sx / length, sy / length, sz / length], i * 3);
  }
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(smoothed, 3));
  return geometry;
}
