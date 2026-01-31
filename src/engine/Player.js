import * as THREE from 'three/webgpu';

/**
 * Player class - a simple capsule representing the airship
 */
export class Player {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();

        // Capsule mesh
        const geometry = new THREE.CapsuleGeometry(0.15, 0.4, 4, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
        this.mesh = new THREE.Mesh(geometry, this.material);

        this.group.add(this.mesh);
        this.scene.add(this.group);
    }

    update(bobOffset = 0) {
        // Apply visual bobbing offset to the mesh within the group
        this.mesh.position.y = bobOffset;
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
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.scene.remove(this.group);
    }
}
