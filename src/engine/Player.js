import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SmokeTrail } from './SmokeTrail.js';

/**
 * Player class - handles the airship model and visual components
 */
export class Player {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();

        // Placeholder mesh while loading
        const geometry = new THREE.CapsuleGeometry(0.15, 0.4, 4, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
        this.placeholder = new THREE.Mesh(geometry, material);
        this.group.add(this.placeholder);

        this.scene.add(this.group);

        // Load the actual airship model
        this.loadModel();

        // Smoke trails setup
        this.smokeTrails = [
            new SmokeTrail(this.scene, { color: 0x555555, size: 0.4, spawnRate: 0.01 }),
            new SmokeTrail(this.scene, { color: 0x555555, size: 0.4, spawnRate: 0.01 })
        ];

        // Default engine offsets (relative to ship center)
        // These will be overridden by Leva if provided
        this.engineOffsets = [
            new THREE.Vector3(-0.48, 0.46, 0.98),
            new THREE.Vector3(0.48, 0.46, 0.98)
        ];
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load('/src/assets/airship.glb', (gltf) => {
            this.model = gltf.scene;

            // Adjust model (User bumped this to 3.0)
            this.model.scale.setScalar(3.0);
            this.model.rotation.y = Math.PI;

            this.group.add(this.model);

            // Remove placeholder once loaded
            if (this.placeholder) {
                this.group.remove(this.placeholder);
                this.placeholder.geometry.dispose();
                this.placeholder.material.dispose();
                this.placeholder = null;
            }
        }, undefined, (error) => {
            console.error('Error loading airship model:', error);
        });
    }

    update(delta, time, bobOffset = 0) {
        const visual = this.model || this.placeholder;
        if (visual) {
            visual.position.y = bobOffset;
        }

        // Update smoke trails
        if (this.smokeTrails) {
            this.smokeTrails.forEach((trail, i) => {
                const offset = this.engineOffsets[i].clone();
                // Apply ship's rotation and position to the offset
                const worldPos = offset.applyQuaternion(this.group.quaternion).add(this.group.position);
                // Add the visual bobbing to smoke positions too if desired, 
                // but usually engines stay with the ship
                worldPos.y += bobOffset;

                trail.emit(worldPos, time);
            });
        }
    }

    get position() {
        return this.group.position;
    }

    get rotation() {
        return this.group.rotation;
    }

    get quaternion() {
        return this.group.quaternion;
    }

    dispose() {
        if (this.placeholder) {
            this.placeholder.geometry.dispose();
            this.placeholder.material.dispose();
        }
        if (this.model) {
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        }
        if (this.smokeTrails) {
            this.smokeTrails.forEach(trail => trail.dispose());
        }
        this.scene.remove(this.group);
    }
}
