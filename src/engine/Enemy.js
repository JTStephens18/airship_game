import * as THREE from 'three/webgpu';

/**
 * Enemy base class - Drifter type that floats toward player
 */
export class Enemy {
    constructor(scene, position, options = {}) {
        this.scene = scene;
        this.id = Math.random().toString(36).substr(2, 9);

        // Stats
        this.health = options.health || 1;
        this.maxHealth = this.health;
        this.damage = options.damage || 10;
        this.speed = options.speed || 3;
        this.collisionRadius = options.collisionRadius || 0.6;

        // State
        this.position = position.clone();
        this.velocity = new THREE.Vector3();
        this.isDead = false;
        this.deathTimer = 0;
        this.deathDuration = 0.3; // Time for death animation

        // Visual
        this.setupVisuals();
    }

    setupVisuals() {
        // Red wireframe sphere for Drifter enemy
        const geometry = new THREE.IcosahedronGeometry(0.5, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            wireframe: true,
            transparent: true,
            opacity: 1.0
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Inner core for visual interest
        const coreGeom = new THREE.IcosahedronGeometry(0.25, 0);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xff6666,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        this.core = new THREE.Mesh(coreGeom, coreMat);
        this.mesh.add(this.core);
    }

    /**
     * AI behavior - move toward player
     */
    update(delta, playerPos) {
        if (this.isDead) {
            // Death animation
            this.deathTimer += delta;
            const t = this.deathTimer / this.deathDuration;

            // Scale down and fade out
            const scale = 1 - t;
            this.mesh.scale.setScalar(Math.max(0.01, scale));
            this.mesh.material.opacity = Math.max(0, 1 - t);

            // Spin during death
            this.mesh.rotation.x += delta * 10;
            this.mesh.rotation.z += delta * 8;

            return this.deathTimer >= this.deathDuration;
        }

        // Move toward player
        const direction = new THREE.Vector3().subVectors(playerPos, this.position);
        const distance = direction.length();

        if (distance > 0.5) {
            direction.normalize();

            // Smooth acceleration
            this.velocity.lerp(direction.multiplyScalar(this.speed), delta * 2);
            this.position.addScaledVector(this.velocity, delta);
            this.mesh.position.copy(this.position);
        }

        // Gentle bobbing and rotation
        this.mesh.rotation.y += delta * 0.5;
        this.core.rotation.x += delta * 2;
        this.core.rotation.z += delta * 1.5;

        return false; // Not ready for disposal
    }

    /**
     * Take damage and check for death
     */
    takeDamage(amount) {
        if (this.isDead) return false;

        this.health -= amount;

        // Flash effect
        this.mesh.material.color.setHex(0xffffff);
        setTimeout(() => {
            if (this.mesh && this.mesh.material) {
                this.mesh.material.color.setHex(0xff3333);
            }
        }, 50);

        if (this.health <= 0) {
            this.isDead = true;
            return true; // Enemy died
        }
        return false;
    }

    /**
     * Check collision with a point (anchor or player)
     */
    checkCollision(point, radius = 0) {
        const distance = this.position.distanceTo(point);
        return distance < (this.collisionRadius + radius);
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            if (this.core) {
                this.core.geometry.dispose();
                this.core.material.dispose();
            }
            this.scene.remove(this.mesh);
        }
    }
}
