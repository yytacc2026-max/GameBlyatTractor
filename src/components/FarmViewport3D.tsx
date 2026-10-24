import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SimulationWorld } from '../engine/farmSimulation';
import { Direction, ImplementType, TileData, VehicleState } from '../types/game';
import { getTotalCargo } from '../engine/farmSimulation';

interface FarmViewport3DProps {
  world: SimulationWorld;
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  onSelectTile?: (tile: TileData) => void;
  cameraPreset: 'isometric' | 'top' | 'follow';
}

const TILE_SIZE = 2.2;

// Module-scope scratch vectors for zero GC in animation loop
const _camTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();

function directionToAngle(dir: Direction): number {
  switch (dir) {
    case 'timur':
      return 0;
    case 'utara':
      return Math.PI / 2;
    case 'barat':
      return Math.PI;
    case 'selatan':
      return -Math.PI / 2;
  }
}

function createProceduralContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTilledSoilTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4A2E1B';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = '#362011';
    ctx.fillRect(0, y, 128, 7);
    ctx.fillStyle = '#5C3A23';
    ctx.fillRect(0, y + 7, 128, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4B5563';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#9CA3AF';
  ctx.fillRect(0, 4, 128, 6);
  ctx.fillRect(0, 118, 128, 6);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(20, 61, 36, 6);
  ctx.fillRect(76, 61, 36, 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Builds a 10-part composite 3D vehicle (Traktor, Pemanen, or Pengangkut) with swappable implements
 */
function buildCompositeVehicleMesh(
  v: VehicleState,
  shadowTex: THREE.Texture,
  castShadow: boolean
): {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  implementGroup: THREE.Group;
  cutterReel: THREE.Object3D | null;
  cargoBoxGroup: THREE.Group;
  currentImplement: ImplementType;
} {
  const root = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  // Soft contact shadow grounded at y = 0.02
  const shadowGeo = new THREE.PlaneGeometry(1.9, 1.9);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const primaryColor =
    v.role === 'traktor' ? 0x22c55e : v.role === 'pemanen' ? 0xeab308 : 0x0ea5e9;
  const secondaryColor =
    v.role === 'traktor' ? 0x15803d : v.role === 'pemanen' ? 0xca8a04 : 0x0369a1;

  const hullMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.35,
    metalness: 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    roughness: 0.6,
    metalness: 0.3,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.7,
    metalness: 0.6,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.88,
    metalness: 0.1,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.7,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    roughness: 0.12,
    metalness: 0.85,
    transparent: true,
    opacity: 0.72,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });

  // 1. Primary Chassis Hull
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 0.76), hullMat);
  chassis.position.set(0, 0.38, 0);
  chassis.castShadow = castShadow;
  chassis.receiveShadow = true;
  root.add(chassis);

  // 2. Engine Hood Nose
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.62), trimMat);
  hood.position.set(0.32, 0.56, 0);
  hood.castShadow = castShadow;
  root.add(hood);

  // 3. Operator Cabin with Windows & Roof
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.52, 0.68), glassMat);
  cab.position.set(-0.22, 0.78, 0);
  cab.castShadow = castShadow;
  root.add(cab);

  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.74), hullMat);
  cabRoof.position.set(-0.22, 1.06, 0);
  cabRoof.castShadow = castShadow;
  root.add(cabRoof);

  // 4. Roof Beacon Light
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    })
  );
  beacon.position.set(-0.22, 1.14, 0);
  root.add(beacon);

  // 5. Exhaust Stack Pipe
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.52, 10), darkMetalMat);
  exhaust.position.set(0.22, 0.84, 0.26);
  exhaust.castShadow = castShadow;
  root.add(exhaust);

  // 6 & 7. Front Headlights
  const leftLight = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), headlightMat);
  leftLight.position.set(0.6, 0.55, 0.2);
  const rightLight = leftLight.clone();
  rightLight.position.set(0.6, 0.55, -0.2);
  root.add(leftLight, rightLight);

  // 8–11. 4 Composite Wheels (Tire + Hub Rim)
  const wheelConfigs = [
    { x: -0.34, y: 0.28, z: 0.44, r: 0.28, w: 0.18 },
    { x: -0.34, y: 0.28, z: -0.44, r: 0.28, w: 0.18 },
    { x: 0.38, y: 0.2, z: 0.42, r: 0.2, w: 0.14 },
    { x: 0.38, y: 0.2, z: -0.42, r: 0.2, w: 0.14 },
  ];

  wheelConfigs.forEach((wc) => {
    const wGroup = new THREE.Group();
    wGroup.position.set(wc.x, wc.y, wc.z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wc.r, wc.r, wc.w, 16), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = castShadow;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(wc.r * 0.52, wc.r * 0.52, wc.w + 0.02, 12),
      rimMat
    );
    rim.rotation.x = Math.PI / 2;
    wGroup.add(tire, rim);
    root.add(wGroup);
    wheels.push(wGroup);
  });

  // Cargo Box Indicator (visualizes harvested crops inside vehicle hopper)
  const cargoBoxGroup = new THREE.Group();
  cargoBoxGroup.position.set(-0.24, 1.18, 0);
  root.add(cargoBoxGroup);

  // 12. Implement Attachment Group (Bajak, Penabur, Pemanen)
  const implementGroup = new THREE.Group();
  root.add(implementGroup);

  const cutterReelHolder: { ref: THREE.Object3D | null } = { ref: null };
  populateImplementGeometry(implementGroup, v.implement, castShadow, cutterReelHolder);

  return {
    root,
    wheels,
    implementGroup,
    cutterReel: cutterReelHolder.ref,
    cargoBoxGroup,
    currentImplement: v.implement,
  };
}

function populateImplementGeometry(
  group: THREE.Group,
  implement: ImplementType,
  castShadow: boolean,
  cutterReelHolder: { ref: THREE.Object3D | null }
) {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
  cutterReelHolder.ref = null;

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.3,
    metalness: 0.8,
  });
  const orangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.4,
    metalness: 0.3,
  });
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
    metalness: 0.35,
  });

  if (implement === 'bajak') {
    // Rear 3-blade steel plow attachment
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.92), redMat);
    bar.position.set(-0.76, 0.24, 0);
    bar.castShadow = castShadow;
    group.add(bar);

    [-0.34, 0, 0.34].forEach((zOff) => {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 6), steelMat);
      blade.position.set(-0.82, 0.14, zOff);
      blade.rotation.z = Math.PI / 4;
      group.add(blade);
    });
  } else if (implement === 'penabur') {
    // Rear seed hopper tank + rotary spreader disc
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.16, 0.42, 12), orangeMat);
    hopper.position.set(-0.75, 0.46, 0);
    hopper.castShadow = castShadow;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16), steelMat);
    disc.position.set(-0.75, 0.2, 0);
    group.add(hopper, disc);
    cutterReelHolder.ref = disc;
  } else if (implement === 'pemanen') {
    // Front Combine Harvester Rotary Cutter Header
    const headerBar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 1.24), orangeMat);
    headerBar.position.set(0.75, 0.24, 0);
    headerBar.castShadow = castShadow;
    group.add(headerBar);

    const reelGroup = new THREE.Group();
    reelGroup.position.set(0.84, 0.32, 0);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.16, 12), steelMat);
    axle.rotation.x = Math.PI / 2;
    reelGroup.add(axle);

    const barGeo = new THREE.BoxGeometry(0.3, 0.03, 1.14);
    const bar1 = new THREE.Mesh(barGeo, steelMat);
    const bar2 = new THREE.Mesh(barGeo, steelMat);
    bar2.rotation.z = Math.PI / 2;
    reelGroup.add(bar1, bar2);

    group.add(reelGroup);
    cutterReelHolder.ref = reelGroup;
  }
}

/**
 * Builds composite 3D farm buildings (Pom Bensin, Gudang, Bengkel)
 */
function buildBuildingMesh(type: 'pom_bensin' | 'gudang' | 'bengkel', castShadow: boolean): THREE.Group {
  const g = new THREE.Group();

  if (type === 'pom_bensin') {
    // Concrete pad + Red/Amber Diesel Pump + Canopy Roof + Fuel Tank
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.8 })
    );
    pad.position.y = 0.04;
    pad.receiveShadow = true;
    g.add(pad);

    const pump = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.72, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, metalness: 0.3 })
    );
    pump.position.set(0, 0.4, -0.35);
    pump.castShadow = castShadow;
    g.add(pump);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.16, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.5,
      })
    );
    screen.position.set(0, 0.54, -0.35);
    g.add(screen);

    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.5 })
    );
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0, 0.34, 0.48);
    tank.castShadow = castShadow;
    g.add(tank);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 })
    );
    canopy.position.set(0, 1.25, 0);
    canopy.castShadow = castShadow;
    g.add(canopy);
  } else if (type === 'gudang') {
    // Barn Warehouse + Cylindrical Silo
    const barn = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.85, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 })
    );
    barn.position.set(-0.22, 0.425, 0);
    barn.castShadow = castShadow;
    g.add(barn);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.88, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
    );
    roof.position.set(-0.22, 1.1, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = castShadow;
    g.add(roof);

    const silo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.35, 16),
      new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.35, metalness: 0.65 })
    );
    silo.position.set(0.52, 0.675, -0.2);
    silo.castShadow = castShadow;
    g.add(silo);

    const siloDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.7 })
    );
    siloDome.position.set(0.52, 1.35, -0.2);
    g.add(siloDome);
  } else if (type === 'bengkel') {
    // Workshop Service Pad + Hoist Gantry + Tool Cabinet
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.08, 1.85),
      new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.75 })
    );
    pad.position.y = 0.04;
    pad.receiveShadow = true;
    g.add(pad);

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.4,
      metalness: 0.5,
    });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), pillarMat);
    p1.position.set(-0.7, 0.6, -0.6);
    const p2 = p1.clone();
    p2.position.set(0.7, 0.6, -0.6);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 0.2), pillarMat);
    beam.position.set(0, 1.2, -0.6);
    g.add(p1, p2, beam);

    const toolChest = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.48, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.4 })
    );
    toolChest.position.set(0, 0.28, -0.6);
    toolChest.castShadow = castShadow;
    g.add(toolChest);
  }

  return g;
}

export const FarmViewport3D: React.FC<FarmViewport3DProps> = ({
  world,
  selectedVehicleId,
  onSelectVehicle,
  onSelectTile,
  cameraPreset,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<SimulationWorld>(world);
  const selectedVehicleRef = useRef<string>(selectedVehicleId);
  const cameraPresetRef = useRef(cameraPreset);
  const onSelectVehicleRef = useRef(onSelectVehicle);
  const onSelectTileRef = useRef(onSelectTile);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    selectedVehicleRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    onSelectVehicleRef.current = onSelectVehicle;
    onSelectTileRef.current = onSelectTile;
  }, [onSelectVehicle, onSelectTile]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard per Three.js Skill Directive
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x18222d);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x18222d, 0.018);

    // 2. Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 140);
    camera.position.set(0, 16, 16);

    // 3. Balanced 3-Point Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x452719, 0.85);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    keyLight.position.set(14, 24, 12);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const d = 14;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 55;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    rimLight.position.set(-12, 10, -10);
    scene.add(rimLight);

    // Extended outdoor meadow ground surrounding the farm board
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: 0x1e2c22, roughness: 0.95, metalness: 0.02 })
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.18;
    outerGround.receiveShadow = true;
    scene.add(outerGround);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createProceduralContactShadowTexture();
    const tilledTex = createTilledSoilTexture(maxAniso);
    const roadTex = createRoadTexture(maxAniso);

    // Shared materials
    const soilUntilledMat = new THREE.MeshStandardMaterial({
      color: 0x6b442a,
      roughness: 0.9,
      metalness: 0.05,
    });
    const soilTilledMat = new THREE.MeshStandardMaterial({
      map: tilledTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const mudMat = new THREE.MeshStandardMaterial({
      color: 0x3b2416,
      roughness: 0.22,
      metalness: 0.15,
    });
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.65,
      metalness: 0.1,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.8,
      metalness: 0.15,
    });

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const vehiclesGroup = new THREE.Group();
    scene.add(vehiclesGroup);

    // Selection ring highlight
    const selectRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.96, 32),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
    );
    selectRing.rotation.x = -Math.PI / 2;
    selectRing.position.y = 0.04;
    scene.add(selectRing);

    // Dynamic registries for current level grid and vehicles
    let builtLevelId = -1;
    let tileMeshes: Array<
      Array<{
        baseMesh: THREE.Mesh;
        cropGroup: THREE.Group;
        lastSoil: string;
        lastCrop: string;
        lastGrowth: number;
      }>
    > = [];

    const vehicleRenderMap: Record<
      string,
      ReturnType<typeof buildCompositeVehicleMesh> & {
        currX: number;
        currZ: number;
        currAngle: number;
        lastCargoCount: number;
      }
    > = {};

    const gridToWorld = (gx: number, gz: number, w: number, h: number) => {
      const offsetX = ((w - 1) * TILE_SIZE) / 2;
      const offsetZ = ((h - 1) * TILE_SIZE) / 2;
      return {
        wx: gx * TILE_SIZE - offsetX,
        wz: gz * TILE_SIZE - offsetZ,
      };
    };

    const rebuildBoardIfNeeded = (wState: SimulationWorld) => {
      if (
        builtLevelId === wState.level.id &&
        tileMeshes.length === wState.height &&
        tileMeshes[0]?.length === wState.width
      ) {
        return;
      }
      builtLevelId = wState.level.id;

      while (boardGroup.children.length > 0) {
        boardGroup.remove(boardGroup.children[0]);
      }
      while (vehiclesGroup.children.length > 0) {
        vehiclesGroup.remove(vehiclesGroup.children[0]);
      }
      for (const k of Object.keys(vehicleRenderMap)) {
        delete vehicleRenderMap[k];
      }
      tileMeshes = [];

      // Farm wooden border frame
      const boardW = wState.width * TILE_SIZE + 0.5;
      const boardH = wState.height * TILE_SIZE + 0.5;
      const baseFrame = new THREE.Mesh(
        new THREE.BoxGeometry(boardW, 0.26, boardH),
        new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.85 })
      );
      baseFrame.position.y = -0.14;
      baseFrame.receiveShadow = true;
      boardGroup.add(baseFrame);

      const tileGeo = new THREE.BoxGeometry(TILE_SIZE - 0.08, 0.16, TILE_SIZE - 0.08);

      for (let z = 0; z < wState.height; z++) {
        const rowArr = [];
        for (let x = 0; x < wState.width; x++) {
          const tData = wState.tiles[z][x];
          const { wx, wz } = gridToWorld(x, z, wState.width, wState.height);

          let mat = soilUntilledMat;
          if (tData.terrain === 'lumpur') mat = mudMat;
          else if (tData.terrain === 'jalan' || tData.terrain === 'pom_bensin' || tData.terrain === 'gudang' || tData.terrain === 'bengkel') {
            mat = roadMat;
          } else if (tData.soil === 'sudah_dibajak') {
            mat = soilTilledMat;
          }

          const baseMesh = new THREE.Mesh(tileGeo, mat);
          baseMesh.position.set(wx, -0.04, wz);
          baseMesh.receiveShadow = true;
          baseMesh.userData = { tileX: x, tileZ: z };
          boardGroup.add(baseMesh);

          // Static props on special terrain tiles
          if (tData.terrain === 'batu') {
            const rockGroup = new THREE.Group();
            rockGroup.position.set(wx, 0.04, wz);
            const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.58, 0), rockMat);
            r1.position.set(-0.1, 0.35, 0.05);
            r1.scale.set(1.1, 0.85, 1.0);
            r1.castShadow = !isSoftwareGl;
            const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), rockMat);
            r2.position.set(0.35, 0.22, -0.2);
            r2.castShadow = !isSoftwareGl;
            rockGroup.add(r1, r2);
            boardGroup.add(rockGroup);
          } else if (
            tData.terrain === 'pom_bensin' ||
            tData.terrain === 'gudang' ||
            tData.terrain === 'bengkel'
          ) {
            const bMesh = buildBuildingMesh(tData.terrain, !isSoftwareGl);
            bMesh.position.set(wx, 0.04, wz);
            boardGroup.add(bMesh);
          }

          const cropGroup = new THREE.Group();
          cropGroup.position.set(wx, 0.04, wz);
          boardGroup.add(cropGroup);

          rowArr.push({
            baseMesh,
            cropGroup,
            lastSoil: tData.soil,
            lastCrop: 'kosong',
            lastGrowth: -1,
          });
        }
        tileMeshes.push(rowArr);
      }
    };

    const updateCropVisual = (
      cropGroup: THREE.Group,
      crop: TileData['crop'],
      growth: number
    ) => {
      while (cropGroup.children.length > 0) {
        cropGroup.remove(cropGroup.children[0]);
      }
      if (crop === 'kosong') return;

      const scaleFactor = 0.35 + (Math.max(10, growth) / 100) * 0.65;
      const isMature = growth >= 100;

      const offsets = [
        [-0.42, -0.42],
        [0.42, -0.42],
        [-0.42, 0.42],
        [0.42, 0.42],
      ];

      offsets.forEach(([ox, oz]) => {
        const plant = new THREE.Group();
        plant.position.set(ox, 0, oz);
        plant.scale.setScalar(scaleFactor);

        if (crop === 'wortel') {
          const rootBody = new THREE.Mesh(
            new THREE.ConeGeometry(0.14, 0.36, 8),
            new THREE.MeshStandardMaterial({
              color: isMature ? 0xf97316 : 0xfb923c,
              roughness: 0.5,
            })
          );
          rootBody.rotation.x = Math.PI;
          rootBody.position.y = 0.14;
          const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 0.34, 6),
            new THREE.MeshStandardMaterial({
              color: isMature ? 0x22c55e : 0x4ade80,
              roughness: 0.6,
            })
          );
          leaves.position.y = 0.36;
          plant.add(rootBody, leaves);
        } else if (crop === 'gandum') {
          const stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.08, 0.58, 6),
            new THREE.MeshStandardMaterial({
              color: isMature ? 0xeab308 : 0x84cc16,
              roughness: 0.55,
            })
          );
          stalk.position.y = 0.29;
          const head = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.09, 0.22, 4, 8),
            new THREE.MeshStandardMaterial({
              color: isMature ? 0xfacc15 : 0xa3e635,
              roughness: 0.45,
            })
          );
          head.position.y = 0.62;
          plant.add(stalk, head);
        } else if (crop === 'jagung') {
          const stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.09, 0.72, 8),
            new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
          );
          stalk.position.y = 0.36;
          plant.add(stalk);
          if (isMature) {
            const cob = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.08, 0.18, 4, 8),
              new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.4 })
            );
            cob.position.set(0.1, 0.48, 0);
            cob.rotation.z = -0.35;
            plant.add(cob);
          }
        }

        cropGroup.add(plant);
      });
    };

    // Mouse / Touch Drag Orbit & Click Raycasting
    let isDragging = false;
    let dragDist = 0;
    let prevX = 0;
    let prevY = 0;
    let cameraAzimuth = Math.PI / 4;
    let cameraZoom = 1.0;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragDist = 0;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      dragDist += Math.abs(dx) + Math.abs(dy);
      prevX = e.clientX;
      prevY = e.clientY;
      cameraAzimuth -= dx * 0.007;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (dragDist < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        // Check vehicles first
        for (const [vId, vEntry] of Object.entries(vehicleRenderMap)) {
          const hits = raycaster.intersectObject(vEntry.root, true);
          if (hits.length > 0) {
            onSelectVehicleRef.current(vId);
            return;
          }
        }

        // Check tiles
        const hits = raycaster.intersectObjects(boardGroup.children, false);
        for (const hit of hits) {
          const u = hit.object.userData;
          if (u && typeof u.tileX === 'number' && typeof u.tileZ === 'number') {
            const t = worldRef.current.tiles[u.tileZ]?.[u.tileX];
            if (t && onSelectTileRef.current) {
              onSelectTileRef.current(t);
            }
            break;
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraZoom = THREE.MathUtils.clamp(cameraZoom + e.deltaY * 0.001, 0.65, 1.55);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 4. Animation Loop with Software-WebGL Pacing Guard
    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const wState = worldRef.current;

      rebuildBoardIfNeeded(wState);

      // Sync tile soil & crops
      for (let z = 0; z < wState.height; z++) {
        for (let x = 0; x < wState.width; x++) {
          const tData = wState.tiles[z][x];
          const cell = tileMeshes[z]?.[x];
          if (!cell) continue;

          if (cell.lastSoil !== tData.soil && tData.terrain === 'tanah_biasa') {
            cell.baseMesh.material =
              tData.soil === 'sudah_dibajak' ? soilTilledMat : soilUntilledMat;
            cell.lastSoil = tData.soil;
          }
          if (cell.lastCrop !== tData.crop || cell.lastGrowth !== tData.growth) {
            updateCropVisual(cell.cropGroup, tData.crop, tData.growth);
            cell.lastCrop = tData.crop;
            cell.lastGrowth = tData.growth;
          }
        }
      }

      // Sync vehicles with smooth damping
      for (const [vId, vData] of Object.entries(wState.vehicles)) {
        const { wx, wz } = gridToWorld(vData.x, vData.z, wState.width, wState.height);
        const targetAngle = directionToAngle(vData.direction);

        let vEntry = vehicleRenderMap[vId];
        if (!vEntry) {
          const built = buildCompositeVehicleMesh(vData, shadowTex, !isSoftwareGl);
          built.root.position.set(wx, 0.04, wz);
          built.root.rotation.y = targetAngle;
          vehiclesGroup.add(built.root);
          vEntry = {
            ...built,
            currX: wx,
            currZ: wz,
            currAngle: targetAngle,
            lastCargoCount: -1,
          };
          vehicleRenderMap[vId] = vEntry;
        }

        // Update implement if changed
        if (vEntry.currentImplement !== vData.implement) {
          const holder: { ref: THREE.Object3D | null } = { ref: null };
          populateImplementGeometry(vEntry.implementGroup, vData.implement, !isSoftwareGl, holder);
          vEntry.cutterReel = holder.ref;
          vEntry.currentImplement = vData.implement;
        }

        // Update cargo visual crates
        const cargoTotal = getTotalCargo(vData.cargo);
        if (vEntry.lastCargoCount !== cargoTotal) {
          while (vEntry.cargoBoxGroup.children.length > 0) {
            vEntry.cargoBoxGroup.remove(vEntry.cargoBoxGroup.children[0]);
          }
          const cratesToShow = Math.min(4, Math.ceil(cargoTotal / 2));
          for (let c = 0; c < cratesToShow; c++) {
            const crate = new THREE.Mesh(
              new THREE.BoxGeometry(0.28, 0.14, 0.36),
              new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
            );
            crate.position.y = c * 0.15;
            vEntry.cargoBoxGroup.add(crate);
          }
          vEntry.lastCargoCount = cargoTotal;
        }

        const prevX = vEntry.currX;
        const prevZ = vEntry.currZ;
        vEntry.currX = THREE.MathUtils.damp(vEntry.currX, wx, 10, dt);
        vEntry.currZ = THREE.MathUtils.damp(vEntry.currZ, wz, 10, dt);

        // Shortest-angle interpolation
        let angleDiff = targetAngle - vEntry.currAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        vEntry.currAngle += angleDiff * Math.min(1, dt * 12);

        vEntry.root.position.set(vEntry.currX, 0.04, vEntry.currZ);
        vEntry.root.rotation.y = vEntry.currAngle;

        const moveSpeed = Math.hypot(vEntry.currX - prevX, vEntry.currZ - prevZ);
        if (moveSpeed > 0.002) {
          vEntry.wheels.forEach((w) => {
            w.rotation.z -= moveSpeed * 3.5;
          });
        }
        if (vEntry.cutterReel && (wState.status === 'running' || moveSpeed > 0.002)) {
          vEntry.cutterReel.rotation.y += dt * 6;
        }

        if (vId === selectedVehicleRef.current) {
          selectRing.position.set(vEntry.currX, 0.05, vEntry.currZ);
        }
      }

      // Smooth Camera Choreography
      const preset = cameraPresetRef.current;
      const selEntry = vehicleRenderMap[selectedVehicleRef.current];
      if (preset === 'follow' && selEntry) {
        _camTarget.set(selEntry.currX, 0.4, selEntry.currZ);
        _desiredCamPos.set(
          selEntry.currX + Math.cos(cameraAzimuth) * 9 * cameraZoom,
          8.5 * cameraZoom,
          selEntry.currZ + Math.sin(cameraAzimuth) * 9 * cameraZoom
        );
      } else if (preset === 'top') {
        _camTarget.set(0, 0, 0);
        _desiredCamPos.set(0, 22 * cameraZoom, 0.01);
      } else {
        _camTarget.set(0, 0, 0);
        const radius = Math.max(wState.width, wState.height) * 2.35 * cameraZoom;
        _desiredCamPos.set(
          Math.cos(cameraAzimuth) * radius,
          radius * 0.82,
          Math.sin(cameraAzimuth) * radius
        );
      }

      camera.position.lerp(_desiredCamPos, Math.min(1, dt * 6));
      camera.lookAt(_camTarget);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (domElem.parentNode === container) {
        container.removeChild(domElem);
      }
    };
  }, []);

  // Floating 2D Vehicle Callouts & Action Badges
  const vehiclesList = Object.values(world.vehicles);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#121518]">
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Non-occluding Top-Center Active Vehicle Action Pill */}
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {vehiclesList.map((v) =>
          v.actionLabel ? (
            <div
              key={v.id}
              className="px-3 py-1 rounded bg-[#181B20]/95 border border-emerald-500/40 text-xs font-mono text-emerald-300 shadow-lg"
            >
              [{v.codeAlias}] {v.actionLabel}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
};
