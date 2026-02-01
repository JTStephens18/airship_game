import * as THREE from 'three/webgpu';
import { Fn, float, vec3, time, positionLocal, uniform, attribute, varying, select } from 'three/tsl';

/**
 * SmokeTrail - A performance-oriented particle system using TSL and InstancedMesh
 */
export class SmokeTrail {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.maxParticles = options.maxParticles || 600;
        this.particleLifetime = options.particleLifetime || 1.2;
        this.color = new THREE.Color(options.color || 0xcccccc);
        this.size = options.size || 0.4;

        this.init(options);
    }

    init(options = {}) {
        // 1. Geometry - small sphere for each smoke puff
        // Using InstancedBufferGeometry to ensure WebGPU knows to draw multiple instances
        const baseGeometry = new THREE.SphereGeometry(this.size, 8, 8);
        const geometry = new THREE.InstancedBufferGeometry().copy(baseGeometry);
        geometry.instanceCount = this.maxParticles;

        // 2. Custom Attributes for Instancing
        // a. Spawn Time
        const spawnTimes = new Float32Array(this.maxParticles).fill(-1000);
        this.spawnTimeAttribute = new THREE.InstancedBufferAttribute(spawnTimes, 1);
        geometry.setAttribute('spawnTime', this.spawnTimeAttribute);

        // b. Spawn Position
        const spawnPositions = new Float32Array(this.maxParticles * 3).fill(0);
        this.spawnPosAttribute = new THREE.InstancedBufferAttribute(spawnPositions, 3);
        geometry.setAttribute('spawnPos', this.spawnPosAttribute);

        // c. Initial Velocity (randomized slight drift)
        const velocities = new Float32Array(this.maxParticles * 3);
        for (let i = 0; i < this.maxParticles; i++) {
            velocities[i * 3] = (Math.random() - 0.5) * 0.5;
            velocities[i * 3 + 1] = Math.random() * 0.5;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        }
        this.velocityAttribute = new THREE.InstancedBufferAttribute(velocities, 3);
        geometry.setAttribute('spawnVel', this.velocityAttribute);

        // d. Random Scale (for puffiness)
        const randomScales = new Float32Array(this.maxParticles);
        for (let i = 0; i < this.maxParticles; i++) {
            randomScales[i] = 0.5 + Math.random() * 1.0;
        }
        this.randomScaleAttribute = new THREE.InstancedBufferAttribute(randomScales, 1);
        geometry.setAttribute('randomScale', this.randomScaleAttribute);

        // 3. TSL Material
        const material = new THREE.MeshBasicNodeMaterial();
        material.transparent = true;
        material.depthWrite = false;
        material.blending = THREE.AdditiveBlending;

        // Attributes as TSL nodes
        const aSpawnTime = attribute('spawnTime');
        const aSpawnPos = attribute('spawnPos');
        const aSpawnVel = attribute('spawnVel');
        const aRandomScale = attribute('randomScale');
        const uLifetime = uniform(this.particleLifetime);
        this.uSize = uniform(this.size);

        // Calculate age
        const age = time.sub(aSpawnTime);
        const normalizedAge = age.div(uLifetime).saturate();

        // Position Logic: SpawnPos + (Vel * age) + gravity-ish drift
        const currentPos = aSpawnPos.add(aSpawnVel.mul(age)).add(vec3(0, age.mul(0.2), 0));

        // Scale Logic: Starts small, grows slightly, then fades/shrunken
        // Multiply by randomScale for variation
        const particleScale = this.uSize.mul(aRandomScale).mul(float(1.0).sub(normalizedAge)).mul(select(aSpawnTime.lessThan(0), 0, 1));

        // Apply to vertex stage
        material.positionNode = Fn(() => {
            // We use the world position calculated, but need to account for the object's own transform
            // Actually, since we update spawnPos in world space, we should probably keep the mesh at origin
            return currentPos.add(positionLocal.mul(particleScale));
        })();

        // Color/Alpha Logic
        material.colorNode = Fn(() => {
            const opacity = float(0.5).mul(float(1.0).sub(normalizedAge));
            return vec3(this.color.r, this.color.g, this.color.b).mul(opacity);
        })();

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.frustumCulled = false; // Always visible as it's a trail
        this.scene.add(this.mesh);

        this.particleIndex = 0;
        this.lastSpawnTime = 0;
        this.spawnRate = options.spawnRate || 0.01; // spawn every 10ms
    }

    setSize(size) {
        this.size = size;
        // Note: Changing geometry size on the fly is expensive, 
        // but we can use an attribute or scale node instead.
        // For now, let's update the scaleNode in the material.
        this.uSize.value = size;
    }

    setSpawnRate(rate) {
        this.spawnRate = rate;
    }

    emit(worldPos, currentTime) {
        if (currentTime - this.lastSpawnTime < this.spawnRate) return;

        const i = this.particleIndex;

        // Update attributes for the next particle in the ring buffer
        this.spawnTimeAttribute.setX(i, currentTime);
        this.spawnPosAttribute.setXYZ(i, worldPos.x, worldPos.y, worldPos.z);

        this.spawnTimeAttribute.needsUpdate = true;
        this.spawnPosAttribute.needsUpdate = true;

        this.particleIndex = (this.particleIndex + 1) % this.maxParticles;
        this.lastSpawnTime = currentTime;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
}
