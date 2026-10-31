# Earbud model: visual audit and refinement plan

Reviewed 31 October 2026. The refinement was implemented and published later the same day as version 83, then withdrawn at the user’s request. The previous earbud model, materials, framing, cables and loading images were restored. The findings below record the original model; implementation notes follow.

## Implemented refinement

The new component master rebuilds the housing, faceplate, bevels, joints, contacts, sensor window, silicone tip and cable sleeve around measured source anchors, retaining the original wing silhouette. Seven explicit materials replace the painted atlas and colour-based runtime material masks. A curved cable follows each sleeve's outlet tangent before hanging downward. Hero scale increased from 0.79 to 0.87, with a slightly tighter stagger; the final fitted scale remains 0.36.

The existing studio rig was retained after checking the clean geometry and new material response under it. Desktop silicone uses mild transmission; phones use a matching opaque material. Desktop and mobile posters were captured from the exact frozen first frame. Download sizes fell from 1,553,052 to 348,316 bytes on desktop and from 972,812 to 168,888 bytes on mobile.

Editable source, reference measurements and a rebuild guide live in `source-assets/earbuds/`. The generator is `scripts/build-premium-earbuds.py`. Both application type checks, 47 focused tests and the production build passed. Browser checks covered desktop and 390 × 844 layouts, turning/seated/rotated poses, reverse movement, and graphics-context recovery. Physical phone GPU performance was not measured; phone checks used browser viewport emulation.

Release receipt: `output/earbud-polish-release-2026-10-31.json`. Visual evidence and build report: `output/earbud-polish-2026-10-31/`.

## Recommended direction

Keep the recognisable winged silhouette, wired construction, black body and champagne accents. Develop the render into a convincing piece of manufactured hardware: even curved surfaces, precise joints, soft silicone, restrained metallic reflections and a believable cable connection.

The largest improvements should come from **clean material maps plus selective geometry rebuilding**, followed by a more deliberate studio-lighting setup. The existing mesh already contains substantial detail. Simply adding polygons, increasing gloss, or raising rendering resolution would leave its main defects intact.

## What was inspected

- The live landing page on desktop and in a 390 × 844 browser viewport, including the hero and the worn transition.
- The local full-size hero using the actual browser materials and lighting.
- Both active earbud GLBs, their embedded colour and metallic/roughness textures, and the loading posters.
- The model preparation, material shaders, normal smoothing, cable geometry, camera framing and lighting code.
- The retained material experiment and editable Blender assets.
- Three offline neutral-material views of the current desktop source, to inspect form without the colour texture.

The offline views preserve the source mesh and imported normals. They use separate neutral lighting and do not include the browser's extra normal-smoothing pass, cable trimming, replacement sleeve or trailing cables. They are diagnostic views, not previews of a proposed finish. Reflected shading artifacts in them can involve both source geometry and source normals; irregular outlines and seam shapes remain directly inspectable.

The desktop source asset and the two key rendering files match the retained `sites/cymba-hero-title-release` checkout. A pre-existing live desktop tab had older headline copy; the fresh mobile visit showed the current learning headline. The product review does not depend on that copy difference.

## Findings and priorities

| Priority | Finding | Why it affects perceived quality | Planned change |
| --- | --- | --- | --- |
| P0 | Colour texture contains strong light/dark bands and dense contour-like marks over the bronze and champagne regions. The metallic/roughness texture also contains coarse irregular variation. | Reflections look broken, patchy or dented; apparent lighting can remain painted onto the surface as the product moves. | Re-author clean base colour and material response by physical part. Remove painted highlights and large-scale surface noise. |
| P0 | The faceplate rim, shell seam, contact pads and nozzle/tip collar have uneven shapes in the neutral source views. | Small manufacturing details read as softened or distorted. Reflective surfaces expose every discontinuity. | Rebuild those visible parts with controlled curves, consistent bevels, clean contact pads and continuous seam widths. |
| P0 | Each earbud is one textured mesh using one shared material definition. Silicone is identified at runtime by its colour values. | Material identity is tied to the existing artwork. Recolouring or compression can change which pixels receive silicone shading. | Export explicit material assignments or authored material-ID masks, with true separate geometry for the tip, contacts and sensor window where appropriate. |
| P1 | The tip is pale, reflective and visually inconsistent between the desktop transmission shader and the mobile opaque approximation. | It can read as cloudy rigid plastic rather than soft silicone. | Use a rounded lip, believable wall thickness, clean inner bore and soft reflections; tune desktop and mobile to the same perceived colour and softness. |
| P1 | The cable is an exactly straight tube that follows the socket position but not its exit direction. | The angled sleeve meets a vertical line without a flexible bend, especially during rotation. | Add a short tangent-continuous curve leaving the sleeve, then settling into the hanging cable. |
| P1 | The product shares a broad studio environment and four directional lights with the sculpture. | The gold receives multiple bright regions while parts of the black body remain difficult to read. | Tune a product-focused key reflection, narrow edge reflection and restrained fill, checking the sculpture under every change. |
| P1 | Earbud bodies occupy a relatively small area of the hero, particularly on mobile; long cables take much of the vertical space. | Fine features are hard to appreciate even with a high-resolution canvas. | Compare approximately 10–20% larger hero bodies and a slightly tighter stagger, while preserving headline/CTA space and the final fitted scale. |
| P2 | Sensor window and contacts are present but visually lack crisp part boundaries. | Functional details look like softened surface marks. | Give existing features defined recesses, edge radii, controlled reflections and subtle local occlusion. |
| P2 | Posters contain the current finish and must remain aligned with the first live frame. | An improved live model would otherwise appear to change finish or position as it loads. | Regenerate both posters after the model, lighting and pose are final; compare cold loading and fallback states. |

## Material specification

Treat these values as starting points for side-by-side visual tuning, not measured properties of the finished product.

| Part | Visual target | Initial roughness range | Notes |
| --- | --- | --- | --- |
| Champagne trim and contacts | Fine satin metal, with a narrow bright bevel and broad controlled gradients | 0.24–0.36 | Use metallic response only for actual exposed metal. Keep the existing champagne identity. Add directional brushing only if the intended manufacturing finish supports it. |
| Main housing | Deep graphite/bronze with readable curvature | 0.32–0.45 | Decide whether this surface represents coated metal or polymer before assigning metalness. Avoid deriving that decision from colour alone. |
| Black wing and strain relief | Soft moulded elastomer | 0.55–0.70 | Non-metallic; clean soft highlights. Very restrained microtexture, visible only at close range. |
| Silicone tip | Soft, lightly translucent smoke grey | 0.45–0.60 | Non-metallic. Test a lower transmission contribution than the current 0.78; retain a soft appearance at actual page size. Use thickness appropriate to the model's world scale. |
| Sensor window | Small, dark, glossy inset | 0.12–0.22 | Clear border and shallow recess. Avoid added glow unless it represents intended product behaviour. |
| Cable | Flexible dark polymer | 0.45–0.60 | Non-metallic, with a broad faint reflection; maintain readable thickness against white. |

Base colour should describe the surface, with illumination supplied by the scene. Keep cavity occlusion separate and subtle around real joints. Khronos specifically advises against baked lighting in product assets because it does not support dynamic lighting or the PBR workflow: [real-time asset guidelines](https://www.khronos.org/assets/uploads/apis/3DCommerce-Realtime-sset-Creation-Guidelines_Jul20.pdf).

A texture-channel check supports the visual diagnosis: bright warm regions have median roughness around **0.16** and metalness around **0.99**, producing strong reflections that expose the existing surface irregularity. Dark regions have median roughness around **0.48** and metalness near **0.01**. The existing atlas therefore already distinguishes metal from dark non-metal surfaces; the goal is cleaner maps and more reliable part control, not correcting a wholesale absence of PBR shading. These are heuristic colour-region measurements, include atlas padding, and are not exact per-component measurements.

Do not blanket-apply maximum clearcoat, gloss, bloom or extra texture. They would obscure the distinctions between the physical parts. The earlier retained `cymba-earbuds-refined.glb` provides a useful comparison for reducing the painted lighting, but its muted finish and unchanged geometry do not resolve the full audit. It should be treated as reference material rather than substituted directly.

## Geometry work

1. **Establish a clean master.** Duplicate the retained Blender source, retain the supplied source, and label the visible components. Keep the existing overall proportions and functional layout.
2. **Rebuild the faceplate and bezel.** Use a consistent elliptical/circular profile appropriate to the current design, an even trim width, and small edge radii that create continuous highlights. Retain intentional asymmetry; remove accidental waviness.
3. **Refine the shell.** Rework local lumps and seam irregularity without globally shrinking or rounding the body. Use curvature-aware normals and deliberately preserve real component boundaries.
4. **Rebuild the tip and nozzle collar.** Model a clean bore, rounded opening, believable wall thickness and a regular attachment transition. Any grille or new internal feature requires confirmation from the actual product design before inclusion.
5. **Refine existing contacts and sensor window.** Keep their location and intended function. Replace distorted disks and recess boundaries with clean, shallow component geometry.
6. **Integrate the cable outlet.** Replace the trimmed source stump and separate runtime patch with a clean source-model sleeve, if feasible. The short exit curve should align to the sleeve before bending down.
7. **Review both sides.** Preserve the intended left/right fit, normal directions, material assignments and feature placement when mirroring or exporting.

The neutral views make the priorities concrete: the rim and seam widths vary; the upper circular contact loses a regular edge; the collar around the nozzle is uneven. These are the first areas to revisit before increasing detail elsewhere.

## Lighting and composition

- Use one broad neutral softbox reflection to describe the housing curvature, a narrower strip to define the bezel, and a low fill to retain detail in the black wing.
- Control dark areas of the environment as well as bright ones so the metal retains contrast without looking mottled.
- Keep the warm colour in the material; use mostly neutral lighting to prevent gold becoming overly yellow or brown.
- Avoid placing a ground shadow directly under a floating product unless the composition establishes a nearby surface. Use soft local contact occlusion at joints and at the fitted ear instead.
- Begin composition comparisons with the current stagger and pose as a baseline. Try a modest size increase, reduced vertical separation, and a slightly more revealing three-quarter angle.
- Ensure at least one earbud clearly shows the faceplate while the other shows the silicone and contacts. Preserve visual separation between the tips, wings and shell.
- Keep idle motion restrained. The current small lift and drift can remain; the cable bend should follow the socket continuously through hero motion and the flight to the ears.
- Hold lighting and camera constant during material comparisons, then tune them after the material and geometry decisions are stable.

## Implementation order and deliverables

### Pass 1 — One-earbud benchmark

Use the existing hero setup to compare the current render with one refined earbud at the same angle and size. Produce a neutral-material view, a material view, and an actual-page-size view. Start with clean material segmentation, the faceplate/bezel, tip and sleeve.

Completion criterion: the improved result has continuous highlights, defined joints and clear metal/rubber/silicone separation both at close range and at hero scale. The shape remains recognisably the same product.

### Pass 2 — Final model and maps

Finish local shell cleanup, contacts, sensor window and source-model cable outlet. Export a master GLB with semantic groups and materials. Generate desktop and mobile delivery versions from the same master.

Completion criterion: front, back, underside and three-quarter views have clean seams, no visible open surfaces, no texture bleeding and no obvious unwanted asymmetry. Texture/material boundaries follow component geometry.

### Pass 3 — Landing-page integration

Update model preparation to load a complete earbud group rather than picking one named mesh. Preserve the motion, fitted pose and device-specific framing. Replace colour-based silicone detection with explicit assignments. Add the curved cable exit. Tune lighting and composition in the page.

Completion criterion: both earbuds remain attached to their cables, seat correctly in the mannequin, and keep the intended materials through the entire forward and reverse scroll.

### Pass 4 — Delivery and verification

Regenerate the posters; update asset version keys; verify cold loading, reduced motion and recovery. Compare desktop and mobile on matched frames and profile the result.

Completion criterion: the initial still and first live frame match, the mobile finish resembles desktop, and measured load/render costs stay within the agreed baseline budget or have a justified visible benefit.

## Integration details that must be handled

- `src/components/three/EarbudExperience.tsx:26` currently searches for one mesh per side. A component-based export needs group-based loading; otherwise it can select only the last matching component.
- Model normalisation currently uses the earbud's bounding-box height. Removing the source cable stump or changing a wing/tip bound can alter overall scale and fitted placement. Preserve calibrated scale and add explicit `cable_outlet`, `tip_center` and fitting anchors.
- The sleeve plane and rim contour are hard-coded in `EarbudExperience.tsx` and `earbudSleeveRim.json`. They must be replaced or remeasured when the sleeve is rebuilt.
- `smoothEarbudNormals.ts` changes normals only, not vertex positions. It cannot correct irregular seam shapes or silhouettes. Bake the accepted normal treatment into both delivery assets instead of relying on runtime repair for the desktop model.
- Desktop uses `MeshPhysicalMaterial`; mobile uses `MeshStandardMaterial`. Restrict transmission to actual silicone geometry so the opaque body avoids unnecessary physical-material work. Three.js documents the additional per-pixel cost of physical-material features: [MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).
- `Scene.tsx` supplies lighting shared by the earbuds and mannequin. Check the sculpture whenever that rig is changed, or separate the product treatment carefully without adding an abrupt lighting change during the transition.
- `PosterStudio.tsx` and `HeroPoster.tsx` should produce and serve the final matching desktop/mobile loading images. Capture the deterministic first-frame pose, not a random point in the idle drift.
- Changes in the root development checkout do not publish automatically. Implementation and any later release need the repository's existing hosted-checkout workflow.

## Measured baseline and performance plan

These measurements come from the current files; some older reports in the repository describe larger earlier assets.

| Asset | File size | Triangles, both earbuds | Embedded textures |
| --- | ---: | ---: | --- |
| Desktop hero | 1,553,052 bytes | 110,870 | 2048² colour JPEG; 2048² metallic/roughness JPEG |
| Mobile hero | 972,812 bytes | 38,720 | 1024² colour JPEG; 1536² metallic/roughness JPEG |
| Desktop poster | 22,268 bytes | — | 1260 × 1410 WebP |
| Mobile poster | 20,086 bytes | — | 1260 × 1410 WebP |

The machine-readable source of these measurements is `asset-analysis.json`.

Both GLBs use one material definition and two earbud meshes. The mobile meshes declare baked smoothed normals; the desktop meshes do not, so the runtime smoothing branch applies there. The source GLBs have no active normal texture and no dedicated occlusion texture. The renderer already enables antialiasing and caps pixel ratio at 2 on desktop and 3 on mobile.

Keep the current asset sizes and triangle totals as initial ceilings, not goals to fill. Concentrate polygons on silhouette and curved edges. Sharing material definitions is useful, but splitting every tiny feature into a separate draw call is unnecessary. Use a small number of meaningful material groups and measure the resulting draw calls.

Re-authoring the maps may allow less texture data despite greater apparent detail. Evaluate compression only after checking subtle gradients and material boundaries. A lossier map that reintroduces banding would undermine the main improvement.

Actual frame rate and GPU cost have not been benchmarked in this audit. Establish them before implementation using a fixed scroll sequence and the existing scene diagnostics. Browser viewport emulation does not establish real-phone performance.

## Verification checklist

- Compare identical camera/light views before and after, including a neutral view and the actual page-sized render.
- Inspect continuous moving reflections across the bezel, shell and nozzle collar. Look for waviness, faceting, seam pops and texture seams.
- Review the front, rear, underside and three-quarter views of both earbuds.
- Test the hero, early turn, flight, final seating and rotated worn pose, including reverse scrolling and repeated transitions.
- Check cable/sleeve tangency, gaps, intersections and the cable fade at each pose.
- Check tip softness and tone on desktop and mobile; also inspect any transmission sorting or white-background artifacts.
- Review at 390px mobile width and typical desktop width, plus narrow phones, tablet boundaries, short screens and landscape layouts.
- Verify the still-to-live transition on a cold load, slow loading, reduced motion, no-WebGL fallback and context recovery.
- Confirm headline and form space remain usable if hero scale changes.
- Run type checking, the relevant existing scene/scroll tests and the production build for the eventual implementation. No runtime changes were made during this audit, so these checks were not rerun now.

## Evidence

- [Desktop landing page](../output/earbud-audit-2026-10-31/live-desktop.png)
- [Current material close-up](../output/earbud-audit-2026-10-31/live-material-closeup.png)
- [Current full-resolution browser render](../output/earbud-audit-2026-10-31/current-render.png)
- [Mobile landing page](../output/earbud-audit-2026-10-31/live-mobile.png)
- [Mobile worn view](../output/earbud-audit-2026-10-31/mobile-worn.png)
- [Neutral source front](../output/earbud-audit-2026-10-31/clay-front.png)
- [Neutral source three-quarter](../output/earbud-audit-2026-10-31/clay-three-quarter.png)
- [Neutral source back](../output/earbud-audit-2026-10-31/clay-back.png)
- [Extracted colour texture](../output/earbud-audit-2026-10-31/atlas-0.jpg)
- [Extracted metallic/roughness texture](../output/earbud-audit-2026-10-31/atlas-1.jpg)
- [Exact asset analysis](../output/earbud-audit-2026-10-31/asset-analysis.json)
- [Texture-channel analysis](../output/earbud-audit-2026-10-31/texture-channel-analysis.json)

The final product's CAD and measured manufacturing material specifications were not supplied for this audit. Preserve the current design intent; confirm manufacturing-dependent details before adding new vents, seams, markings, grilles or finishes.
