"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MotionValue } from "motion/react";
import * as THREE from "three";
import { MANNEQUIN_AO_URL, MANNEQUIN_STONE_NORMAL_URL, MANNEQUIN_STONE_ROUGHNESS_URL, MANNEQUIN_MODEL_URL, MANNEQUIN_MOBILE_MODEL_URL } from "./productAssets";
import { useSceneQuality } from "./sceneQuality";

/** One soft radial falloff, drawn once: the same contact shadow on every device. */
function contactShadowAlpha() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [stop, value] of [[0, 255], [0.18, 250], [0.38, 210], [0.58, 128], [0.78, 42], [1, 0]] as const) {
    gradient.addColorStop(stop, `rgb(${value},${value},${value})`);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

// Shared by the colour and depth passes: keep the face solid while allowing
// the actual brain geometry to show through a softly feathered crown.
const crownGLSL = `
  float crownMask(vec3 p) {
    float posterior = 1.0 - smoothstep(-0.65, -0.05, p.z);
    float brow = 0.30 + 0.42 * smoothstep(0.20, 1.22, p.z) + 0.28 * posterior;
    return smoothstep(brow, brow + 0.56, p.y);
  }
`;

// One clock links the ear contact, the input paths and the cortical response.
// The delay grows away from the ears, so light always has a visible source.
const stimulusGLSL = `
  float corticalDelay(vec3 p) {
    vec3 fromEar = vec3(abs(p.x)-1.06, (p.y+0.04)*0.95, (p.z-0.14)*0.75);
    return 0.38 + length(fromEar)*0.72;
  }
  float responseWave(float delay) {
    if (pulseTime < 0.0) return 0.72;
    float elapsed = pulseTime - 0.28 - delay;
    float age = mod(elapsed+1.4,2.8)-1.4;
    // A compact leading light with a longer, smoothly fading wake.
    float width = age < 0.0 ? 0.07 : 0.30;
    return exp(-pow(age/width,2.0))*smoothstep(-0.10,0.0,elapsed);
  }
`;

// Fine input-nerve pulses, softly transmitted through the intact skin.
// Three curved branches share an ear source and carry short, staggered packets.
// This changes radiance only: the crown remains the sole transparent region.
const subdermalGLSL = `
  float nervePulse(float delay) {
    return pulseTime < 0.0 ? 0.60 : pow(responseWave(delay),2.4);
  }
  float nerveFilament(float z, float centre, float radius, float delay) {
    // Preserve fine strands on small screens without a broad halo.
    float width = max(radius,fwidth(z)*0.70);
    float d = (z-centre)/width;
    float strand = exp(-d*d)+0.10*exp(-d*d*0.25);
    return strand*nervePulse(delay);
  }
  vec2 subdermalSignal(vec3 position) {
    vec3 p = vec3(abs(position.x), position.yz);
    vec3 contactOffset = (p-vec3(1.06,-0.04,0.14))/vec3(0.24,0.055,0.060);
    float contact = exp(-dot(contactOffset,contactOffset)*2.0)*nervePulse(0.0);
    float height = max(p.y+0.04,0.0);
    float t = clamp(height/0.80,0.0,1.0);
    float centre = mix(0.14,-0.04,t)+0.075*sin(t*3.14159);
    float forkA = smoothstep(0.06,0.78,t);
    float forkB = smoothstep(0.20,0.92,t);
    float radius = mix(0.013,0.009,t);
    float delay = 0.10+height/1.25;
    float mainNerve = nerveFilament(p.z,centre+0.012*sin(t*8.0),radius,delay);
    float forwardNerve = nerveFilament(p.z,centre+0.20*forkA+0.020*sin(t*7.0)*forkA,radius*0.85,delay+0.10*forkA);
    float rearNerve = nerveFilament(p.z,centre-0.17*forkB-0.018*sin(t*9.0)*forkB,radius*0.80,delay+0.17*forkB);
    float side = smoothstep(0.70,0.96,p.x);
    float ends = smoothstep(-0.10,0.04,p.y)*(1.0-smoothstep(0.52,0.82,p.y));
    float travelling = max(mainNerve,max(forwardNerve*0.90,rearNerve*0.85))*side*ends;
    float strength = smoothstep(0.12,0.22,neuralActivity);
    return vec2(contact,travelling)*strength;
  }
`;

function positionVarying(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vSculpturePosition;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSculpturePosition = position;");
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
    varying vec3 vSculpturePosition;
    uniform float neuralActivity;
    uniform float skullReveal;
    ${crownGLSL}
  `);
}

/** Ivory sculpture with a gradual crown reveal and branching cortical signals. */
export function Mannequin({ reveal, stimulation, stimulationVisibility }: {
  reveal: MotionValue<number>;
  stimulation: MotionValue<number>;
  stimulationVisibility?: MotionValue<number>;
}) {
  const { mobile } = useSceneQuality();
  const { scene } = useGLTF(mobile ? MANNEQUIN_MOBILE_MODEL_URL : MANNEQUIN_MODEL_URL, "/draco/");
  const maps = useTexture(mobile
    ? { occlusion: MANNEQUIN_AO_URL }
    : { occlusion: MANNEQUIN_AO_URL, stoneNormal: MANNEQUIN_STONE_NORMAL_URL, stoneRoughness: MANNEQUIN_STONE_ROUGHNESS_URL }) as {
    occlusion: THREE.Texture; stoneNormal?: THREE.Texture; stoneRoughness?: THREE.Texture;
  };
  const root = useRef<THREE.Group>(null);
  const reducedMotion = useRef(false);
  const requestDraw = useRef<() => void>(() => {});
  const nextFrame = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = preference.matches; requestDraw.current(); };
    update(); preference.addEventListener("change", update);
    return () => { preference.removeEventListener("change", update); if (nextFrame.current !== null) clearTimeout(nextFrame.current); };
  }, []);

  const prepared = useMemo(() => {
    const { occlusion, stoneNormal, stoneRoughness } = maps;
    for (const texture of [occlusion, stoneNormal, stoneRoughness]) {
      if (!texture) continue;
      texture.flipY = false; texture.channel = 0; texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
    }
    const model = scene.clone(true);
    const activity = { value: 0 }, skullReveal = { value: 0 }, pulseTime = { value: 0 };
    let signalElapsed = 0;
    const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const brainMeshes: THREE.Mesh[] = [], inputMeshes: THREE.Mesh[] = [], surfaceMeshes: THREE.Mesh[] = [];
    const surfaceDepth = new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,side:THREE.FrontSide});
    surfaceDepth.onBeforeCompile = shader => {
      shader.uniforms.neuralActivity = activity; shader.uniforms.skullReveal = skullReveal;
      positionVarying(shader);
      shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        // This guard is spatially fixed. The colour pass continuously fades
        // the crown, so a changing depth threshold cannot make the brain pop in.
        if (crownMask(vSculpturePosition) > 0.001) discard;
      `);
    };
    surfaceDepth.customProgramCacheKey = () => "cymba-cortical-depth-v5";
    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Also suppress old cached assets during a local hot reload.
      if (mesh.name.includes("Fibres")) { mesh.visible = false; return; }
      const isBrain = mesh.name === "Cortical_Brain" || mesh.name === "Brainstem";
      const isNeural = mesh.name === "Cortical_Neural_Arbors";
      const isInput = mesh.name === "Ear_to_Cortex_Signal";
      const prepare = (source: THREE.Material) => {
        const cached = materials.get(source);
        if (cached) return cached;
        const material = !isBrain && !isNeural && !isInput && !mobile ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(material, source as THREE.MeshStandardMaterial);
        if (material instanceof THREE.MeshPhysicalMaterial) {
          material.defines = { STANDARD: "", PHYSICAL: "" };
          material.sheen = 0.3; material.sheenRoughness = 0.7; material.sheenColor.set("#fff6ea");
        }
        material.transparent = true; material.opacity = 0; material.depthWrite = isBrain;
        material.side = THREE.FrontSide; material.metalness = 0;
        material.map = null; material.emissiveMap = null; material.metalnessMap = null;
        material.envMapIntensity = 0.38;
        if (isNeural || isInput) {
          material.color.set("#665280"); material.roughness = 0.48;
          material.depthWrite = false;
          material.onBeforeCompile = shader => {
            shader.uniforms.neuralActivity = activity; shader.uniforms.skullReveal = skullReveal; shader.uniforms.pulseTime = pulseTime;
            positionVarying(shader);
            shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vNeuralPath;")
              .replace("#include <begin_vertex>", "#include <begin_vertex>\nvNeuralPath = uv;");
            shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
              varying vec2 vNeuralPath;
              uniform float pulseTime;
              ${stimulusGLSL}
            `).replace("#include <emissivemap_fragment>", isInput ? `#include <emissivemap_fragment>
              float contact = smoothstep(0.12,0.22,neuralActivity);
              float wave = responseWave(vNeuralPath.x);
              float calibre = 0.65+vNeuralPath.y*0.35;
              vec3 trail = vec3(2.25,0.12,1.75);
              vec3 core = vec3(4.60,0.28,2.80);
              totalEmissiveRadiance = trail*(0.045+wave*0.65) + core*pow(wave,3.0)*1.5;
              diffuseColor.a *= contact * calibre * (0.20 + wave*0.80);
            ` : `#include <emissivemap_fragment>
              float arbor = floor(vNeuralPath.y);
              float seed = fract(sin(arbor*127.1 + 7.3)*43758.5453);
              float secondary = fract(sin(arbor*43.7 + 19.1)*13842.174);
              float importance = fract(vNeuralPath.y) * 2.0;
              float delay = corticalDelay(vSculpturePosition);
              // Recruitment starts at the temporal cortex beside the ear,
              // then reaches the crown and the rest of the network.
              float onset = smoothstep(delay-0.22,delay+0.18,neuralActivity*2.6);
              // Cumulative distance is continuous through every branch junction:
              // the same packet splits into daughter fibres instead of blinking
              // whole arbors on and off. Each arbor has a gently varied speed.
              float speed = mix(0.62,0.90,seed);
              float outgoing = responseWave(delay + seed*0.22 + vNeuralPath.x/speed);
              float returning = responseWave(2.8 + delay + secondary*0.35 - vNeuralPath.x/(speed*0.72));
              returning *= pulseTime < 0.0 ? 0.0 : smoothstep(3.0,3.6,pulseTime)*0.22;
              float signal = outgoing + returning;
              vec3 resting = mix(vec3(0.58,0.025,0.72),vec3(0.86,0.035,0.54),secondary);
              vec3 trail = mix(vec3(1.80,0.035,2.50),vec3(3.10,0.045,1.65),seed);
              vec3 core = vec3(4.80,0.25,3.20);
              totalEmissiveRadiance = onset * (resting*(0.12+importance*0.17)
                + trail*signal*0.85 + core*pow(outgoing,3.0)*1.05);
              diffuseColor.rgb = vec3(0.36,0.08,0.30);
              diffuseColor.a *= onset * (0.65 + importance*0.35);
            `).replace("#include <opaque_fragment>", `
              // Intrinsic fibre light is independent of the bright studio lights
              // illuminating the marble. Otherwise the strands bleach to white.
              outgoingLight = totalEmissiveRadiance;
              #include <opaque_fragment>
            `);
          };
        } else if (isBrain) {
          material.color.set("#c2b5c4"); material.roughness = 0.68;
          material.onBeforeCompile = shader => {
            shader.uniforms.neuralActivity = activity; shader.uniforms.skullReveal = skullReveal; shader.uniforms.pulseTime = pulseTime;
            positionVarying(shader);
            shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vSulcus;")
              .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSulcus = uv.x;");
            shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nvarying float vSulcus;\nuniform float pulseTime;\n${stimulusGLSL}`)
              .replace("#include <color_fragment>", `#include <color_fragment>
                // Retain the real folds with soft cavity colour, not a drawn texture.
                diffuseColor.rgb *= mix(vec3(0.87, 0.82, 0.89), vec3(1.0), vSulcus);
              `)
              .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
                // The tissue stays pearlescent. Light belongs to the fine arbors,
                // leaving the actual gyri and sulci legible between the strands.
                float delay = corticalDelay(vSculpturePosition);
                float recruited = smoothstep(delay-0.22,delay+0.18,neuralActivity*2.6);
                float response = responseWave(delay)*recruited*smoothstep(0.18,0.85,vSulcus);
                totalEmissiveRadiance = vec3(0.018,0.010,0.018) + vec3(0.12,0.012,0.075)*response;
              `);
          };
        } else {
          material.color.set("#f4efe7"); material.normalMap = stoneNormal ?? null;
          material.normalScale.setScalar(0.35); material.roughnessMap = stoneRoughness ?? null;
          material.roughness = stoneRoughness ? 0.78 : 0.42;
          material.aoMap = occlusion; material.aoMapIntensity = 0.65;
          material.onBeforeCompile = shader => {
            shader.uniforms.neuralActivity = activity; shader.uniforms.skullReveal = skullReveal; shader.uniforms.pulseTime = pulseTime;
            positionVarying(shader);
            shader.fragmentShader = shader.fragmentShader
              .replace(crownGLSL, `${crownGLSL}\nuniform float pulseTime;\n${stimulusGLSL}\n${subdermalGLSL}`)
              .replace("#include <color_fragment>", `#include <color_fragment>
                vec2 underSkin = subdermalSignal(vSculpturePosition);
                // Local colour keeps each fine, moving packet legible on ivory.
                float scatter = clamp(underSkin.x*0.48+underSkin.y*0.52,0.0,0.58);
                diffuseColor.rgb *= mix(vec3(1.0),vec3(0.94,0.30,0.72),scatter);
              `)
              .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
                totalEmissiveRadiance += vec3(2.40,0.075,1.65)*underSkin.x
                  + vec3(1.45,0.025,1.10)*underSkin.y;
              `)
              .replace("#include <normal_fragment_maps>", THREE.ShaderChunk.normal_fragment_maps.replace(
                "mapN.xy *= normalScale;", "mapN.xy *= normalScale * mix(1.0,0.1,crownMask(vSculpturePosition));"))
              .replace("#include <aomap_fragment>", THREE.ShaderChunk.aomap_fragment.replace(
                "reflectedLight.indirectDiffuse *= ambientOcclusion;",
                "ambientOcclusion = mix(ambientOcclusion,1.0,crownMask(vSculpturePosition));\nreflectedLight.indirectDiffuse *= ambientOcclusion;"))
              .replace("#include <opaque_fragment>", `
                float rim = pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0);
                float porcelain = 0.12 + rim * 0.55;
                diffuseColor.a *= mix(1.0,porcelain,crownMask(vSculpturePosition)*skullReveal);
                #include <opaque_fragment>
              `);
          };
        }
        material.customProgramCacheKey = () => `cymba-cortical-${isInput?"input":isNeural?"arbors":isBrain?"brain":"shell"}-v16-${mobile}`;
        materials.set(source, material); return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prepare) : prepare(mesh.material);
      mesh.castShadow = !mobile && !isBrain && !isNeural && !isInput;
      mesh.receiveShadow = !mobile && !isBrain && !isNeural && !isInput;
      mesh.renderOrder = isBrain ? 0 : isNeural || isInput ? 1 : 2;
      if (isBrain || isNeural) { brainMeshes.push(mesh); mesh.visible = false; }
      else if (isInput) { inputMeshes.push(mesh); mesh.visible = false; }
      else surfaceMeshes.push(mesh);
    });
    for (const mesh of surfaceMeshes) {
      const depth = new THREE.Mesh(mesh.geometry, surfaceDepth);
      depth.name = `${mesh.name}_RevealDepth`;
      depth.position.copy(mesh.position); depth.quaternion.copy(mesh.quaternion); depth.scale.copy(mesh.scale);
      depth.matrix.copy(mesh.matrix); depth.matrixAutoUpdate = mesh.matrixAutoUpdate;
      depth.renderOrder = -2; mesh.parent?.add(depth);
    }
    const bounds = new THREE.Box3().setFromObject(model);
    const shadowGeometry = new THREE.PlaneGeometry(1,1);
    const shadowMaterial = new THREE.MeshBasicMaterial({color:"#2b2731",transparent:true,opacity:0,depthWrite:false,alphaMap:contactShadowAlpha(),toneMapped:false});
    return {model,materials:[...materials.values()],brainMeshes,inputMeshes,
      advanceSignal: (delta: number, contact: boolean) => { signalElapsed = contact ? signalElapsed + delta : 0; return signalElapsed; },
      surfaceDepth,activity,skullReveal,pulseTime,shadowGeometry,shadowMaterial,shadowY:bounds.min.y-0.015,
      shadowScale:[Math.max(2.4,(bounds.max.x-bounds.min.x)*1.15),Math.max(1.6,(bounds.max.z-bounds.min.z)*0.78),1] as [number,number,number],
      shadowZ:(bounds.min.z+bounds.max.z)/2-0.3,lastVisibility:Number.NaN};
  }, [scene,maps,mobile]);

  useEffect(() => () => {
    prepared.materials.forEach(material=>material.dispose()); prepared.surfaceDepth.dispose();
    prepared.shadowGeometry.dispose(); prepared.shadowMaterial.alphaMap?.dispose(); prepared.shadowMaterial.dispose();
  }, [prepared]);

  useFrame((state,delta) => {
    requestDraw.current = state.invalidate;
    if (nextFrame.current !== null) { clearTimeout(nextFrame.current); nextFrame.current = null; }
    const visibility=THREE.MathUtils.clamp(reveal.get(),0,1);
    const signalVisibility=THREE.MathUtils.clamp(stimulationVisibility?.get()??1,0,1);
    if(root.current) root.current.visible=visibility>0.001;
    if(visibility!==prepared.lastVisibility) {if(!mobile)state.gl.shadowMap.needsUpdate=true;prepared.lastVisibility=visibility;}
    // The entrance fade and the brain reveal are separate phases. Damping must
    // never carry an earlier brain pose into the partially transparent head.
    const target=visibility===1 ? THREE.MathUtils.clamp(stimulation.get(),0,1)*signalVisibility : 0;
    // Closing follows the scroll ceiling, so residual transparency reaches zero
    // before the front-facing pose instead of snapping shut at the boundary.
    prepared.activity.value=Math.min(target,THREE.MathUtils.damp(prepared.activity.value,target,3.2,delta>.1?1/60:delta));
    if(Math.abs(prepared.activity.value-target)<.0001)prepared.activity.value=target;
    // Open the crown a little ahead of the signal strength. The gentle ease-out
    // keeps both endpoints and the smooth rewind, while exposing the folds sooner.
    const activity=prepared.activity.value;
    prepared.skullReveal.value=activity*(1.5-.5*activity);
    const active=visibility>.001&&signalVisibility>.001&&prepared.activity.value>.055;
    for(const mesh of prepared.brainMeshes)mesh.visible=visibility>.001&&signalVisibility>.001&&prepared.activity.value>.001;
    const contact=visibility===1&&signalVisibility>.001&&activity>.12;
    for(const mesh of prepared.inputMeshes)mesh.visible=contact;
    for(const material of prepared.materials)material.opacity=visibility;
    prepared.shadowMaterial.opacity=visibility*.3;
    // Replay from the ear on entry; background gaps must not jump to an
    // unrelated point in a global clock. Reduced motion shows a steady response.
    const signalTime=prepared.advanceSignal(reducedMotion.current?0:delta>.1?1/60:delta,contact);
    prepared.pulseTime.value=reducedMotion.current?-1:signalTime;
    const moving=prepared.activity.value!==target;
    if(visibility>.001&&signalVisibility>.001&&moving)state.invalidate();
    // Only the visible, active chapter requests gentle ongoing motion. The
    // existing scene suspends offscreen/background rendering; reduced motion
    // holds an illuminated still. Idle signal motion is capped at 30 fps.
    else if(active&&!reducedMotion.current&&prepared.brainMeshes.length) {
      nextFrame.current=setTimeout(()=>{nextFrame.current=null;state.invalidate();},1000/30);
    }
  });
  return <group ref={root} visible={false} dispose={null}>
    <mesh name="Sculpture contact shadow" geometry={prepared.shadowGeometry} material={prepared.shadowMaterial}
      position={[0,prepared.shadowY,prepared.shadowZ]} rotation={[-Math.PI/2,0,0]} scale={prepared.shadowScale} renderOrder={-3} />
    <primitive object={prepared.model} dispose={null} />
  </group>;
}
