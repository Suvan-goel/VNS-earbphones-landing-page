The local hero uses a two-earbud presentation:

- cymba-neural-mannequin-organic-detailed.glb: active mannequin, about 3.9 MB.
  Original organic network with fuller tapered fibres, subtle variations in
  bundle thickness and smooth seam normals. Existing 1,129 paths, growth UVs,
  head geometry and texture bytes are preserved; no added triangles or draws.
  Rebuild: node output/neural-mannequin/refine_organic_fibres.mjs
  Validation: output/neural-mannequin/organic-fibres-detailed-report.json.
  Original organic GLB and editable Blender source are retained unchanged.
- cymba-sculpture-ao.png: 1024px, 368 KB linear cavity occlusion baked from
  the active head's exact UV0; fibres and earbuds are excluded from the bake.
  Rebuild: Blender --background --python output/neural-mannequin/bake_sculpture_occlusion.py
  Validation: output/neural-mannequin/sculpture-occlusion-report.json.
  Mannequin.tsx combines it with fine stone grain, restrained satin
  highlights and reduced environment fill. The head alone casts/receives the
  studio key's 1024px self-shadow; its geometry and fibre alignment are unchanged.
- cymba-sculpture-stone-normal.png and cymba-sculpture-stone-roughness.png:
  active surface treatment, adapted from Poly Haven's CC0 "Marble 01" by
  Rob Tuytel (https://polyhaven.com/a/marble_01). A tile-interior patch of
  the downloaded surface maps is baked onto the exact head UV0, preserving
  geometry and fibre alignment. Uniform white base colour; no albedo map,
  grey veins or tile joints. Linear OpenGL normal and roughness maps use
  flipY=false. Original downloads are in assets/sculpture-surface/marble_01.
  Normal map: 2048px, 2.63 MB; roughness: 1024px, 320 KB, range 0.46-0.58.
  Rebuild: Blender --background --python output/neural-mannequin/bake_sculpture_stone.py
  Validation: output/neural-mannequin/sculpture-stone-report.json.
- cymba-sculpture-marble-color.jpg and cymba-sculpture-marble-roughness.png:
  retained previous treatment, no longer displayed. Carrara-style mineral veins
  baked onto the same head UV0, with
  cool white stone, grey mineral variation and a satin-polished finish.
  Albedo is 2048px sRGB; roughness is 1024px linear grayscale. Both use
  flipY=false. AO, head geometry and neural fibre geometry are preserved.
  Rebuild: Blender --background --python output/neural-mannequin/bake_sculpture_marble.py
  Validation: output/neural-mannequin/sculpture-marble-report.json.
- cymba-neural-mannequin-premium.glb: retained previous mannequin, about 1.2 MB.
  User-supplied Meshy sculpture with clean Blender-baked ivory marble and
  continuous 3D neural filaments traced from its original cranial pattern.
  Finer posterior and neck curves; two mesh/material draws, Draco geometry.
  Editable source: output/neural-mannequin/cymba-neural-mannequin-premium.blend.
  Counts and ordered reproduction steps: output/neural-mannequin/premium-fibres-report.json.
- cymba-neural-mannequin.glb: retained previous marble/neural treatment.
  The original user-supplied download is unchanged.
- cymba-earbuds-refined.glb: unused material exploration, 1.34 MB, Draco compressed.
  Blender-refined PBR base colour, roughness, metalness and microfinish maps:
  smoke-grey silicone, satin champagne accents and graphite/charcoal body.
  Original mesh silhouette and UVs retained.
- cymba-earbuds-hero.glb: active hero, 2.93 MB original, Draco compressed; the two original
  textured earbud meshes. The source file remains unchanged; EarbudExperience.tsx
  refines cloned materials with satin champagne trim, graphite-bronze housing,
  softer silicone reflections and no scanned scratch normal map. Cloned vertex
  normals are gently smoothed without changing the silhouette or UVs.
- cymba-earbuds-hero-poster.webp: transparent 1200x1344 loading/fallback still,
  captured from the same live finish through /dev/hero-poster.
- cymba-sculpted-head.glb: previous mannequin, retained but unused; 377 KB,
  Draco compressed; a realistic human head
  scan by Lee Perry-Smith, licensed under CC BY 3.0. Smoothed, cropped,
  tapered and normalized into a sculpted bust. Full attribution, source
  links, license and modifications are in credits.txt, linked in the footer.
- cymba-head-ao.webp: 24 KB, 1024px grayscale ambient occlusion baked from
  the sculpted geometry; source UV0 retained in the head GLB.
- Draco decoder files are served locally from /public/draco/.

EarbudExperience.tsx turns each glTF mesh upright, centres it using precise
vertex bounds, and normalizes its height to one scene unit. Each has an
independent, smooth cable hanging straight down and fading along its length.
The hero presents the pair at a smaller scale, with a strong vertical stagger,
closer spacing, and a slight turn away from the viewer. It contains no
Y connector, controller, coil or USB lead.

Scroll progress moves and scales the pair onto the supplied Meshy head in
Mannequin.tsx, then rotates the head and fitted earbuds through only 45 degrees
in total, finishing at a slight angle to the front.
One continuous scroll curve keeps the rotation in the same direction during
the earbud landing and stimulation chapters, then holds the final angle.
The closed, opaque head uses white stone with baked surface relief. Purple highlights
progressively illuminate from the ears/neck to the crown as scroll advances
through 36–84% of the stage. A smooth ear-centred leading wave settles into steady violet radiance,
with a short damped response to scrolling and a reversible reveal.
NeuralGlow.tsx adds selective HDR bloom at two scales on a transparent canvas;
white marble and metallic earbud highlights do not contribute to the bloom. This includes
the additional posterior network; the initial unlit fibres stay stone-like.
The neck paths are continuous; the short posterior motif stops at the upper
neck. All neural highlights are schematic artistic projections.
The head becomes visible during the transition. The layout reverses when scrolling up;
the signal follows scroll progress and the renderer pauses when offscreen.
Reduced-motion layouts retain still imagery.

The editable full product remains in
output/meshy-earbud-blender/cymba-wired-assembly.blend. Its full-resolution
export and previous wired assembly web assets are preserved. New hero asset
provenance and cable anchors are in output/web-model/hero-asset-report.json.
Previous head preparation, renders and bounds are in
output/mannequin-source. That retained head uses Y up and faces +Z, with ear canals
approximately at (+/-1.03, 0.05, 0.04), crown y=1.984 and base y=-2.3.
The active Meshy mannequin also uses Y up and faces +Z, with ear canals
approximately (+/-1.1475, 0.05, 0.04), crown y=1.852 and base y=-2.429.

Refined material source and editable Blender hero:
output/earbud-refinement/cymba-earbuds-refined.blend
output/earbud-refinement/cymba-refined-hero.blend
Reproducible material processing and provenance:
output/earbud-refinement/refine_materials.py
output/earbud-refinement/refinement-report.json
