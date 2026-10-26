/** Framing for the complete assembly, normalized to 5.2 units wide. */
export type AssemblyPose = {
  x: number;
  y: number;
  width: number;
  height: number;
  tiltX: number;
  tiltY: number;
};

export const fullAssembly: AssemblyPose = { x: 0, y: 0, width: 6.2, height: 3.6, tiltX: 0.06, tiltY: -0.06 };
export const earbudDetail: AssemblyPose = { x: -1.65, y: 0.82, width: 2.8, height: 1.95, tiltX: -0.06, tiltY: 0.08 };
const controllerDetail: AssemblyPose = { x: 2.05, y: 0.35, width: 2.1, height: 2.8, tiltX: 0, tiltY: 0 };

export const ORBIT_EARBUD = "Earbud · L · supplied textured mesh";
export const ORBIT_START = 0.3;
export const ORBIT_END = 0.67;

type CameraPose = AssemblyPose & {
  z: number;
  yaw: number;
  pitch: number;
  contextOpacity: number;
};

const cameraPose = (frame: AssemblyPose, extra: Partial<CameraPose> = {}): CameraPose => ({
  ...frame, z: 0, yaw: -frame.tiltY, pitch: frame.tiltX, contextOpacity: 1, ...extra,
});
// Centre of the supplied left mesh after ProductModel's rotation and normalization.
const singleEarbud = cameraPose({ ...earbudDetail, x: -2.211835, y: 0.966703, width: 1.1, height: 1.1 }, {
  z: 0.011483, yaw: 0, pitch: 0.08, contextOpacity: 0,
});
const turn = Math.PI * 2;

const frames: [number, CameraPose][] = [
  [0, cameraPose(fullAssembly)],
  [0.14, cameraPose(fullAssembly, { yaw: -0.16, pitch: 0.12 })],
  [0.19, cameraPose(fullAssembly, { yaw: 0.12, pitch: -0.06 })],
  [0.26, { ...singleEarbud, width: 1.65, height: 1.65, yaw: -0.2, contextOpacity: 0 }],
  [ORBIT_START, singleEarbud],
  [ORBIT_END, { ...singleEarbud, yaw: turn }],
  [0.69, { ...singleEarbud, yaw: turn }],
  // Pull back before returning the cables, then travel to the controller.
  [0.735, cameraPose(fullAssembly, { yaw: turn, pitch: 0.04, contextOpacity: 0 })],
  [0.755, cameraPose(fullAssembly, { yaw: turn, pitch: 0.04 })],
  [0.8, cameraPose(controllerDetail, { yaw: turn })],
  [0.85, cameraPose(controllerDetail, { yaw: turn + 0.15, pitch: -0.06 })],
  [1, cameraPose(controllerDetail, { yaw: turn + 0.15, pitch: -0.06 })],
];

export function assemblyPoseAt(progress: number): CameraPose {
  if (progress >= ORBIT_START && progress <= ORBIT_END) {
    const t = (progress - ORBIT_START) / (ORBIT_END - ORBIT_START);
    const eased = t * t * (3 - 2 * t);
    return {
      ...singleEarbud,
      yaw: turn * eased,
      // A shallow rising and falling arc reveals the fin and underside as well as both faces.
      pitch: 0.08 + Math.sin(turn * eased) * 0.22,
      width: 1.1 - Math.sin(Math.PI * t) * 0.08,
      height: 1.1 - Math.sin(Math.PI * t) * 0.08,
    };
  }
  if (progress <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [end, b] = frames[i];
    if (progress > end) continue;
    const [start, a] = frames[i - 1];
    const t = (progress - start) / (end - start);
    const eased = t * t * (3 - 2 * t);
    const pose = {} as CameraPose;
    for (const key of Object.keys(a) as (keyof CameraPose)[]) {
      pose[key] = a[key] + (b[key] - a[key]) * eased;
    }
    return pose;
  }
  return frames[frames.length - 1][1];
}

export function assemblyCameraDistance(pose: AssemblyPose, aspect: number, fov: number) {
  const halfAngle = Math.tan((fov * Math.PI) / 360);
  return Math.max(pose.height, pose.width / Math.max(aspect, 0.1)) / (2 * halfAngle);
}
