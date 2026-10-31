"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type MotionValue } from "motion/react";
import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { useSceneQuality } from "./sceneQuality";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** A small, selective HDR bloom. White marble and metal never feed the halo. */
export function NeuralGlow({ progress }: { progress: MotionValue<number> }) {
  const { mobile } = useSceneQuality();
  // Phones use one small halo pass; desktop retains the layered soft falloff.
  return <CorticalGlow progress={progress} mobile={mobile} />;
}

function CorticalGlow({ progress, mobile }: { progress: MotionValue<number>; mobile: boolean }) {
  const { size, viewport, gl } = useThree();
  const pipeline = useMemo(() => {
    const target = (depthBuffer = false) => new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, depthBuffer,
    });
    const beauty = target(true);
    beauty.samples = Math.min(mobile ? 2 : 4, gl.capabilities.maxSamples);
    const source = target();
    const levels = Array.from({ length: mobile ? 1 : 3 }, () => ({ scratch: target(), output: target() }));
    const extract = new THREE.ShaderMaterial({
      vertexShader, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { inputTexture: { value: beauty.texture } },
      fragmentShader: `
        uniform sampler2D inputTexture;
        varying vec2 vUv;
        void main() {
          vec3 radiance = texture2D(inputTexture, vUv).rgb;
          float magenta = smoothstep(0.10, 0.50, min(radiance.r, radiance.b) - radiance.g);
          float peak = max(radiance.r, max(radiance.g, radiance.b));
          // Emitted cortical light feeds the glow; the ivory sculpture stays
          // below the magenta threshold, which accepts both pink and violet.
          float excess = max(peak - 1.35, 0.0) / max(peak, 0.001);
          gl_FragColor = vec4(min(radiance, vec3(6.0)) * magenta * excess, 1.0);
        }
      `,
    });
    const blur = new THREE.ShaderMaterial({
      vertexShader, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: {
        inputTexture: { value: source.texture },
        direction: { value: new THREE.Vector2() },
      },
      fragmentShader: `
        uniform sampler2D inputTexture;
        uniform vec2 direction;
        varying vec2 vUv;
        void main() {
          vec3 color = texture2D(inputTexture, vUv).rgb * 0.227027;
          color += texture2D(inputTexture, vUv + direction * 1.384615).rgb * 0.316216;
          color += texture2D(inputTexture, vUv - direction * 1.384615).rgb * 0.316216;
          color += texture2D(inputTexture, vUv + direction * 3.230769).rgb * 0.070270;
          color += texture2D(inputTexture, vUv - direction * 3.230769).rgb * 0.070270;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const composite = new THREE.ShaderMaterial({
      vertexShader, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      uniforms: {
        beauty: { value: beauty.texture },
        tightHalo: { value: levels[0].output.texture },
        softHalo: { value: levels[Math.min(1, levels.length - 1)].output.texture },
        wideHalo: { value: levels[levels.length - 1].output.texture },
        wideStrength: { value: mobile ? 0 : 0.025 },
        glowStrength: { value: 0 },
      },
      fragmentShader: `
        uniform sampler2D beauty;
        uniform sampler2D tightHalo;
        uniform sampler2D softHalo;
        uniform sampler2D wideHalo;
        uniform float wideStrength;
        uniform float glowStrength;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(beauty, vUv);
          vec3 nearLight = texture2D(tightHalo, vUv).rgb * glowStrength;
          vec3 softLight = texture2D(softHalo, vUv).rgb * glowStrength;
          vec3 wideLight = texture2D(wideHalo, vUv).rgb * glowStrength;
          vec3 glow = nearLight * 0.35 + softLight * 0.12 + wideLight * wideStrength;
          // A restrained tint within the tight halo keeps light legible on
          // white stone without staining broad patches of the sculpture.
          float localScatter = (1.0 - exp(-max(nearLight.r,nearLight.b) * 0.8)) * 0.06 * base.a;
          base.rgb *= vec3(1.0, 1.0 - localScatter * 0.55, 1.0 - localScatter * 0.08);
          float haloAlpha = clamp(max(glow.r, max(glow.g, glow.b)) * 0.12, 0.0, 1.0);
          float alpha = base.a + (1.0 - base.a) * haloAlpha;
          gl_FragColor = vec4((base.rgb + glow) / max(alpha, 0.0001), alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          // Preserve the transparent canvas, including the soft silhouette glow.
          gl_FragColor.rgb *= alpha;
        }
      `,
    });
    return { beauty, source, levels, extract, blur, composite, quad: new FullScreenQuad(extract) };
  }, [gl, mobile]);

  useEffect(() => {
    const width = Math.max(1, Math.round(size.width * viewport.dpr));
    const height = Math.max(1, Math.round(size.height * viewport.dpr));
    pipeline.beauty.setSize(width, height);
    // Soft glow needs only half resolution, with a cap for large Retina displays.
    const scale = Math.min(mobile ? 0.33 : 0.5, (mobile ? 400 : 960) / Math.max(width, height));
    pipeline.source.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    pipeline.levels.forEach((level, index) => {
      const levelScale = scale / 2 ** index;
      for (const target of [level.scratch, level.output]) {
        target.setSize(Math.max(1, Math.round(width * levelScale)), Math.max(1, Math.round(height * levelScale)));
      }
    });
  }, [pipeline, size.width, size.height, viewport.dpr, mobile]);

  useEffect(() => () => {
    for (const target of [pipeline.beauty, pipeline.source, ...pipeline.levels.flatMap((level) => [level.scratch, level.output])]) target.dispose();
    pipeline.extract.dispose();
    pipeline.blur.dispose();
    pipeline.composite.dispose();
    pipeline.quad.dispose();
  }, [pipeline]);

  const frames = useRef(0);
  useFrame(({ gl: renderer, scene, camera }) => {
    // Keep the base colour/alpha conversion identical on every frame. Switching
    // between direct and HDR rendering flashes the translucent head on rewind.
    frames.current++;
    const previousTarget = renderer.getRenderTarget();
    const { beauty, source, levels, quad, extract, blur, composite } = pipeline;
    const glowStrength = THREE.MathUtils.smoothstep(progress.get(), 0.42, 0.50);
    composite.uniforms.glowStrength.value = glowStrength;
    try {
      renderer.setRenderTarget(beauty);
      renderer.clear();
      renderer.render(scene, camera);
      const pass = (material: THREE.ShaderMaterial, destination: THREE.WebGLRenderTarget | null) => {
        quad.material = material;
        renderer.setRenderTarget(destination);
        quad.render(renderer);
      };
      const soften = (input: THREE.WebGLRenderTarget, output: THREE.WebGLRenderTarget, scratch: THREE.WebGLRenderTarget) => {
        blur.uniforms.inputTexture.value = input.texture;
        blur.uniforms.direction.value.set(1 / output.width, 0);
        pass(blur, scratch);
        blur.uniforms.inputTexture.value = scratch.texture;
        blur.uniforms.direction.value.set(0, 1 / output.height);
        pass(blur, output);
      };
      // Successive half-size blurs keep samples adjacent. Enlarging a single
      // kernel's stride created repeated purple bands around the silhouette.
      // Prepare the halo shaders once without showing them. Outside the signal
      // chapter only the shared scene/composite passes run; cached glow is zeroed.
      if (glowStrength > 0 || frames.current === 3) {
        pass(extract, source);
        let input = source;
        for (const level of levels) {
          soften(input, level.output, level.scratch);
          input = level.output;
        }
      }
      pass(composite, previousTarget);
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  }, 1);

  return null;
}
