import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
    }

    loadModel() {
        const loader = new GLTFLoader();
        // Asset is in src/assets/airship.glb, which Vite serves
        loader.load('/src/assets/airship.glb', (gltf) => {
            this.model = gltf.scene;

            // Basic adjustments - increased scale for better visibility
            this.model.scale.setScalar(3.0);
            // Most models need to be rotated 180 or 90 to face forward (-Z)
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

    update(bobOffset = 0) {
        // Apply visual bobbing offset to the group
        // If the model is loaded, we apply it to that, otherwise to the placeholder
        const visual = this.model || this.placeholder;
        if (visual) {
            visual.position.y = bobOffset;
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
        this.scene.remove(this.group);
    }
}
