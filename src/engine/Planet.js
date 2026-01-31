import * as THREE from 'three/webgpu';
import {
    uniform, float, int, vec3, vec2, vec4,
    storage, instanceIndex, vertexIndex, array, Fn,
    positionWorld, max, smoothstep, color, mix, Loop,
    positionLocal, positionGeometry, texture
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
        };
    }

    setupTextures() {
        const loader = new THREE.TextureLoader();

        // Assuming assets are available at this path
        const assetPath = '/src/assets/';

        this.textures = {
            water: loader.load(`${assetPath}water3.png`),
            sand: loader.load(`${assetPath}dirt.png`),
            grass: loader.load(`${assetPath}grass1.png`),
            rock: loader.load(`${assetPath}rock.jpg`),
        };

        // Configure textures
        Object.values(this.textures).forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
        });
    }

    setupGeometry() {
        this.geometry = new THREE.PlaneGeometry(
            this.planeWidth,
            this.planeHeight,
            this.planeWidthSegments,
            this.planeHeightSegments
        );
        this.geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane
    }

    setupMaterials() {
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

        this.material = new THREE.MeshStandardNodeMaterial();

        // Displacement logic in positionNode
        this.material.positionNode = Fn(() => {
            const pos = positionLocal.toVar();

            const noiseValue = fbm(
                pos,
                this.uniforms.octaves,
                this.uniforms.frequency,
                this.uniforms.amplitude,
                this.uniforms.lacunarity,
                this.uniforms.persistence
            );

            const rawHeight = noiseValue.add(this.uniforms.heightOffset).mul(this.uniforms.heightScale);
            const finalHeight = max(rawHeight, this.uniforms.waterFloor);

            pos.y.assign(finalHeight);
            return pos;
        })();

        // Color logic based on height and textures
        this.material.colorNode = Fn(() => {
            const h = positionLocal.y;
            const pos = positionWorld;

            const worldUV = pos.xz.mul(0.25);
            const waterWorldUV = pos.xz.mul(1.0);

            const tWater = texture(this.textures.water, waterWorldUV);
            const tSand = texture(this.textures.sand, worldUV);
            const tGrass = texture(this.textures.grass, worldUV);
            const tRock = texture(this.textures.rock, worldUV);

            let finalColor = tWater;

            const sandMix = smoothstep(-2.0, 1.5, h);
            finalColor = mix(finalColor, tSand, sandMix);

            const grassMix = smoothstep(1.5, 3.0, h);
            finalColor = mix(finalColor, tGrass, grassMix);

            const rockMix = smoothstep(6.0, 8.0, h);
            finalColor = mix(finalColor, tRock, rockMix);

            return vec4(finalColor.rgb, 1.0);
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
    }

    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
        if (this.mesh) this.scene.remove(this.mesh);
    }
}
