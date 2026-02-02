import * as THREE from 'three/webgpu';
import {
    uniform, float, int, vec3, vec2, vec4,
    storage, instanceIndex, vertexIndex, array, Fn,
    positionWorld, max, smoothstep, color, mix, Loop,
    positionLocal, positionGeometry, texture,
    screenUV, screenSize, varying, select, saturate
} from 'three/tsl';
import { cnoise } from './components/perlin.js';

export class Planet {
    constructor(scene) {
        this.scene = scene;

        this.planeWidth = 512;
        this.planeHeight = 512;
        this.planeWidthSegments = 100;
        this.planeHeightSegments = 100;

        this.count = (this.planeWidthSegments + 1) * (this.planeHeightSegments + 1);

        this.setupUniforms();
        this.setupTextures();
        this.setupGeometry();
        this.setupMaterials();
        this.setupMesh();
    }

    setupUniforms() {
        this.uniforms = {
            octaves: uniform(2),
            frequency: uniform(0.06),
            amplitude: uniform(0.2),
            lacunarity: uniform(1.6),
            persistence: uniform(0.9),
            heightScale: uniform(35),
            heightOffset: uniform(0.09),
            waterFloor: uniform(-2.0),

            // Grid Following & Curvature
            uSegmentSize: uniform(this.planeWidth / this.planeWidthSegments),
            uCameraPosition: uniform(new THREE.Vector3()),

            // Material transitions
            uSandStart: uniform(0.5),
            uSandEnd: uniform(2.7),
            uGrassStart: uniform(1.5),
            uGrassEnd: uniform(3.0),
            uHorizonDist: uniform(116),
            uHorizonCurve: uniform(0.06),

            // Material transitions
            uSandStart: uniform(-1.0),
            uSandEnd: uniform(1.5),
            uGrassStart: uniform(1.5),
            uGrassEnd: uniform(3.0),
            uRockStart: uniform(6.0),
            uRockEnd: uniform(8.0),

            // Fog
            uFogColor: uniform(color('#aec7ff')),
            uFogNear: uniform(80),
            uFogFar: uniform(150),

            // Shadow
            uShadowPosition: uniform(new THREE.Vector3()),
            uShadowRotation: uniform(0.0),
            uShadowOffset: uniform(0.0),
            uShadowRadius: uniform(4.0),
            uShadowOpacity: uniform(0.5),
        };
    }

    setupTextures() {
        const loader = new THREE.TextureLoader();
        const assetPath = '/src/assets/';

        this.textures = {
            water: loader.load(`${assetPath}water3.png`),
            sand: loader.load(`${assetPath}sand1.png`),
            grass: loader.load(`${assetPath}grass1.png`),
            rock: loader.load(`${assetPath}rock.jpg`),
            airshipShadow: loader.load(`${assetPath}airship_shadow_crop.png`),
        };

        this.textures.airshipShadow.wrapS = THREE.ClampToEdgeWrapping;
        this.textures.airshipShadow.wrapT = THREE.ClampToEdgeWrapping;

        Object.values(this.textures).forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
        });
    }

    setupGeometry() {
        const tempGeom = new THREE.PlaneGeometry(
            this.planeWidth,
            this.planeHeight,
            this.planeWidthSegments,
            this.planeHeightSegments
        );
        tempGeom.rotateX(-Math.PI / 2);

        const initialData = tempGeom.attributes.position.array;

        // Storage attributes for compute
        this.positionStorageAttribute = new THREE.StorageBufferAttribute(initialData, 3);
        this.baseStorageAttribute = new THREE.StorageBufferAttribute(new Float32Array(initialData), 3);

        this.geometry = tempGeom;
        // We will use vertexIndex to read from storage buffer in material
    }

    setupMaterials() {

        const bayerMatrixNodes = [
            0.0 / 64.0, 48.0 / 64.0, 12.0 / 64.0, 60.0 / 64.0, 3.0 / 64.0, 51.0 / 64.0, 15.0 / 64.0, 63.0 / 64.0,
            32.0 / 64.0, 16.0 / 64.0, 44.0 / 64.0, 28.0 / 64.0, 35.0 / 64.0, 19.0 / 64.0, 47.0 / 64.0, 31.0 / 64.0,
            8.0 / 64.0, 56.0 / 64.0, 4.0 / 64.0, 52.0 / 64.0, 11.0 / 64.0, 59.0 / 64.0, 7.0 / 64.0, 55.0 / 64.0,
            40.0 / 64.0, 24.0 / 64.0, 36.0 / 64.0, 20.0 / 64.0, 43.0 / 64.0, 27.0 / 64.0, 39.0 / 64.0, 23.0 / 64.0,
            2.0 / 64.0, 50.0 / 64.0, 14.0 / 64.0, 62.0 / 64.0, 1.0 / 64.0, 49.0 / 64.0, 13.0 / 64.0, 61.0 / 64.0,
            34.0 / 64.0, 18.0 / 64.0, 46.0 / 64.0, 30.0 / 64.0, 33.0 / 64.0, 17.0 / 64.0, 45.0 / 64.0, 29.0 / 64.0,
            10.0 / 64.0, 58.0 / 64.0, 6.0 / 64.0, 54.0 / 64.0, 9.0 / 64.0, 57.0 / 64.0, 5.0 / 64.0, 53.0 / 64.0,
            42.0 / 64.0, 26.0 / 64.0, 38.0 / 64.0, 22.0 / 64.0, 41.0 / 64.0, 25.0 / 64.0, 37.0 / 64.0, 21.0 / 64.0
        ].map(v => float(v));

        const bayerArray = array(bayerMatrixNodes);

        const fbm = Fn(([pos, octaves, frequency, amplitude, lacunarity, persistence]) => {
            const p = vec3(pos).toVar();
            const total = float(0.0).toVar();
            const currFreq = float(frequency).toVar();
            const currAmp = float(amplitude).toVar();

            Loop({ start: 0, end: octaves }, () => {
                const noiseVal = cnoise(vec3(p.x.mul(currFreq), 0.0, p.z.mul(currFreq)));
                total.addAssign(noiseVal.mul(currAmp));
                currFreq.mulAssign(lacunarity);
                currAmp.mulAssign(persistence);
            });
            return total;
        });

        const positionBuffer = storage(this.positionStorageAttribute, 'vec3', this.count);
        const baseBuffer = storage(this.baseStorageAttribute, 'vec3', this.count);

        this.computeUpdate = Fn(() => {
            const index = instanceIndex;
            const localPos = baseBuffer.element(index);

            // Snapping logic
            const snapX = this.uniforms.uCameraPosition.x.div(this.uniforms.uSegmentSize).floor().mul(this.uniforms.uSegmentSize);
            const snapZ = this.uniforms.uCameraPosition.z.div(this.uniforms.uSegmentSize).floor().mul(this.uniforms.uSegmentSize);
            const worldOffset = vec3(snapX, 0.0, snapZ);
            const worldPos = localPos.add(worldOffset);

            // Noise sampling at fixed world position
            const noiseValue = fbm(
                worldPos,
                this.uniforms.octaves,
                this.uniforms.frequency,
                this.uniforms.amplitude,
                this.uniforms.lacunarity,
                this.uniforms.persistence
            );

            const rawHeight = noiseValue.add(this.uniforms.heightOffset).mul(this.uniforms.heightScale);

            // Horizon curvature
            const distToCam = worldPos.xz.sub(this.uniforms.uCameraPosition.xz).length();
            const normalizedDist = distToCam.div(this.uniforms.uHorizonDist);
            const drop = normalizedDist.pow(4.0).mul(this.uniforms.uHorizonCurve).mul(100.0);

            const curvedHeight = rawHeight.sub(drop);
            const curvedWaterFloor = this.uniforms.waterFloor.sub(drop);
            const finalHeight = max(curvedHeight, curvedWaterFloor);

            const finalPos = vec3(worldPos.x, finalHeight, worldPos.z);
            positionBuffer.element(index).assign(finalPos);
        })().compute(this.count);

        this.material = new THREE.MeshStandardNodeMaterial();

        this.material.positionNode = Fn(() => {
            return positionBuffer.element(vertexIndex);
        })();

        this.applyRetroEffects = Fn(([inputColor, colorNum]) => {
            const uv = screenUV;
            const col = inputColor.rgb.toVar();

            const pixelPos = uv.mul(screenSize).toVar();

            const x = int(pixelPos.x).mod(8);
            const y = int(pixelPos.y).mod(8);
            const index = y.mul(8).add(x);

            const threshold = bayerArray.element(index);

            // 1. Dithering Logic
            const ditherStrength = float(0.6);
            col.addAssign(threshold.sub(0.8).mul(ditherStrength));
            const levels = colorNum.sub(1.0);
            col.assign(col.mul(levels).add(0.5).floor().div(levels));

            return col;
        });

        this.material.colorNode = Fn(() => {
            const pos = positionWorld;
            const dist = pos.xz.sub(this.uniforms.uCameraPosition.xz).length();

            // Re-calculate visual height for texturing (inverse of drop)
            const normalizedDist = dist.div(this.uniforms.uHorizonDist);
            const drop = normalizedDist.pow(4.0).mul(this.uniforms.uHorizonCurve).mul(100.0);
            const h = pos.y.add(drop);

            const worldUV = pos.xz.mul(0.25);
            const waterWorldUV = pos.xz.mul(1.0);

            const tWater = texture(this.textures.water, waterWorldUV);
            const tSand = texture(this.textures.sand, worldUV);
            const tGrass = texture(this.textures.grass, worldUV);
            const tRock = texture(this.textures.rock, worldUV);

            let finalColor = tWater;
            finalColor = mix(finalColor, tSand, smoothstep(this.uniforms.uSandStart, this.uniforms.uSandEnd, h));
            finalColor = mix(finalColor, tGrass, smoothstep(this.uniforms.uGrassStart, this.uniforms.uGrassEnd, h));
            finalColor = mix(finalColor, tRock, smoothstep(this.uniforms.uRockStart, this.uniforms.uRockEnd, h));

            const fogFactor = smoothstep(this.uniforms.uFogNear, this.uniforms.uFogFar, dist);
            finalColor = mix(finalColor, this.uniforms.uFogColor, fogFactor);

            const colorNum = float(4.0);
            const retroColor = this.applyRetroEffects(finalColor, colorNum).toVar();

            // === SHADOW CALCULATION ===
            const shadowWorldPos = positionWorld;

            // 1. Center coordinates relative to shadow position
            const relPos = shadowWorldPos.xz.sub(this.uniforms.uShadowPosition.xz).toVar();

            // 2. Rotate coordinates by uShadowRotation to align with ship
            // Removing negate() to fix inverted rotation
            const angle = this.uniforms.uShadowRotation;
            const s = angle.sin();
            const c = angle.cos();
            const rotatedX = relPos.x.mul(c).sub(relPos.y.mul(s));
            const rotatedZ = relPos.x.mul(s).add(relPos.y.mul(c));

            // 3. Texture-based Shadow
            // Offset rotatedZ to move shadow forward/backward relative to ship
            const rotatedPos = vec2(rotatedX, rotatedZ.add(this.uniforms.uShadowOffset));

            // Re-calculate hShadow (flat height) for height distance
            const distFromShip = shadowWorldPos.xz.sub(this.uniforms.uCameraPosition.xz).length();
            const normDist = distFromShip.div(this.uniforms.uHorizonDist);
            const sCurveDrop = normDist.pow(4.0).mul(this.uniforms.uHorizonCurve).mul(100.0);
            const hShadow = shadowWorldPos.y.add(sCurveDrop);

            const shipHeight = this.uniforms.uShadowPosition.y.sub(hShadow);

            // Limit ship height to prevent division by zero or negative scale
            const shadowScale = shipHeight.div(10.0).add(1.0).max(0.1);
            const finalShadowSize = this.uniforms.uShadowRadius.mul(2.0).mul(shadowScale).max(0.1);

            const shadowUV = rotatedPos.div(finalShadowSize).add(0.5);

            // Bounds check to prevent repeating
            const isInBounds = shadowUV.x.greaterThan(0.0).and(shadowUV.x.lessThan(1.0))
                .and(shadowUV.y.greaterThan(0.0).and(shadowUV.y.lessThan(1.0)));

            const shadowTex = texture(this.textures.airshipShadow, shadowUV);
            const shadowAlpha = select(isInBounds, shadowTex.a, float(0.0));

            // Fade shadow as airship gets higher
            const heightFade = smoothstep(float(35.0), float(2.0), shipHeight);
            const finalShadowFactor = saturate(shadowAlpha.mul(this.uniforms.uShadowOpacity).mul(heightFade));

            // Apply shadow by darkening the retro color
            retroColor.mulAssign(float(1.0).sub(finalShadowFactor));

            return vec4(retroColor.rgb, 1.0);
        })();

        this.material.side = THREE.DoubleSide;
    }

    setupMesh() {
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
    }

    updateControls(params) {
        if (params.octaves !== undefined) this.uniforms.octaves.value = params.octaves;
        if (params.frequency !== undefined) this.uniforms.frequency.value = params.frequency;
        if (params.amplitude !== undefined) this.uniforms.amplitude.value = params.amplitude;
        if (params.lacunarity !== undefined) this.uniforms.lacunarity.value = params.lacunarity;
        if (params.persistence !== undefined) this.uniforms.persistence.value = params.persistence;
        if (params.heightScale !== undefined) this.uniforms.heightScale.value = params.heightScale;
        if (params.heightOffset !== undefined) this.uniforms.heightOffset.value = params.heightOffset;
        if (params.waterFloor !== undefined) this.uniforms.waterFloor.value = params.waterFloor;

        if (params.horizonDistance !== undefined) this.uniforms.uHorizonDist.value = params.horizonDistance;
        if (params.horizonCurve !== undefined) this.uniforms.uHorizonCurve.value = params.horizonCurve;
        if (params.fogNear !== undefined) this.uniforms.uFogNear.value = params.fogNear;
        if (params.fogFar !== undefined) this.uniforms.uFogFar.value = params.fogFar;
        if (params.fogColor !== undefined) this.uniforms.uFogColor.value.set(params.fogColor);

        if (params.sandStart !== undefined) this.uniforms.uSandStart.value = params.sandStart;
        if (params.sandEnd !== undefined) this.uniforms.uSandEnd.value = params.sandEnd;
        if (params.grassStart !== undefined) this.uniforms.uGrassStart.value = params.grassStart;
        if (params.grassEnd !== undefined) this.uniforms.uGrassEnd.value = params.grassEnd;
        if (params.rockStart !== undefined) this.uniforms.uRockStart.value = params.rockStart;
        if (params.rockEnd !== undefined) this.uniforms.uRockEnd.value = params.rockEnd;

        if (params.shadowRadius !== undefined) this.uniforms.uShadowRadius.value = params.shadowRadius;
        if (params.shadowOpacity !== undefined) this.uniforms.uShadowOpacity.value = params.shadowOpacity;
        if (params.shadowOffset !== undefined) this.uniforms.uShadowOffset.value = params.shadowOffset;
    }

    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
        if (this.mesh) this.scene.remove(this.mesh);
    }
}
