import * as THREE from 'three/webgpu';

/**
 * Anchor class - A heavy wrecking ball with spring physics
 */
export class Anchor {
    constructor(scene, shipRef, options = {}) {
        this.scene = scene;
        this.shipRef = shipRef; // Reference to player's group or controller

        // Config
        this.chainLength = options.chainLength || 6;
        this.anchorMass = options.anchorMass || 5;
        this.anchorRadius = options.anchorRadius || 0.8;
        this.springStiffness = options.springStiffness || 80;
        this.springDamping = options.springDamping || 8;
        this.gravityStrength = options.gravityStrength || 20;

        // Trail & Chain config
        this.trailLength = options.trailLength || 6;
        this.chainSegmentCount = options.chainSegmentCount || 10;
        this.opacityFalloff = options.opacityFalloff || 0.6;

        // Aim Assist
        this.aimAssistStrength = options.aimAssistStrength || 5;
        this.aimAssistRange = options.aimAssistRange || 8;

        // State
        this.position = new THREE.Vector3(0, 8, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.trailBuffer = [];

        // Visuals
        this.setupVisuals();
    }

    setupVisuals() {
        // Anchor Mesh
        const geometry = new THREE.IcosahedronGeometry(this.anchorRadius, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xffcc00, wireframe: true });
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        // Chain Segments
        this.chainSegments = [];
        const chainGeom = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const chainMat = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true });
        for (let i = 0; i < this.chainSegmentCount; i++) {
            const segment = new THREE.Mesh(chainGeom, chainMat);
            this.chainSegments.push(segment);
            this.scene.add(segment);
        }

        // Ghost Trail
        this.ghosts = [];
        const ghostGeom = new THREE.IcosahedronGeometry(this.anchorRadius * 0.9, 1);
        for (let i = 0; i < 12; i++) {
            const ghostMat = new THREE.MeshBasicMaterial({
                color: 0xffcc00,
                transparent: true,
                opacity: Math.pow(this.opacityFalloff, i + 1),
                wireframe: true
            });
            const ghost = new THREE.Mesh(ghostGeom, ghostMat);
            ghost.visible = false;
            this.ghosts.push(ghost);
            this.scene.add(ghost);
        }
    }

    applyAttraction(targetPoint, strength, delta) {
        // Apply force toward a target point (e.g. mouse cursor)
        const direction = new THREE.Vector3().subVectors(targetPoint, this.position);
        direction.y = 0; // Horizontal force only
        const dist = direction.length();

        if (dist > 1) { // Deadzone
            direction.normalize();
            const force = Math.min(dist / 20, 1) * strength;
            this.velocity.addScaledVector(direction, force * delta);
        }
    }

    update(delta, currentChainLength, enemies = []) {
        const shipPos = this.shipRef.position;

        // 1. Spring Constraint
        const direction = new THREE.Vector3().subVectors(this.position, shipPos);
        const distance = direction.length();

        if (distance > currentChainLength) {
            direction.normalize();
            const stretch = distance - currentChainLength;

            // Spring force
            const springForce = -stretch * this.springStiffness;

            // Damping (radial)
            const radialVelocity = this.velocity.dot(direction);
            const dampingForce = -radialVelocity * this.springDamping;

            const totalForce = springForce + dampingForce;
            this.velocity.addScaledVector(direction, totalForce * delta);
        }

        // 2. Gravity
        this.velocity.y -= this.gravityStrength * delta;

        // 3. Aim Assist
        if (enemies.length > 0 && this.aimAssistStrength > 0) {
            let nearestEnemy = null;
            let nearestDist = this.aimAssistRange;

            for (const enemy of enemies) {
                const enemyPos = enemy.position;
                const dist = this.position.distanceTo(enemyPos);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = enemyPos;
                }
            }

            if (nearestEnemy) {
                const toEnemy = new THREE.Vector3().subVectors(nearestEnemy, this.position);
                toEnemy.y = 0;
                toEnemy.normalize();
                const force = (1 - nearestDist / this.aimAssistRange) * this.aimAssistStrength;
                this.velocity.addScaledVector(toEnemy, force * delta);
            }
        }

        // 4. Integrator
        this.position.addScaledVector(this.velocity, delta);
        this.mesh.position.copy(this.position);

        // 5. Update Visuals (Chain)
        for (let i = 0; i < this.chainSegmentCount; i++) {
            const t = (i + 1) / (this.chainSegmentCount + 1);
            this.chainSegments[i].position.lerpVectors(shipPos, this.position, t);
        }

        // 6. Update Visuals (Trail)
        this.trailBuffer.unshift(this.position.clone());
        if (this.trailBuffer.length > this.trailLength) this.trailBuffer.pop();

        for (let i = 0; i < this.ghosts.length; i++) {
            if (i < this.trailBuffer.length) {
                this.ghosts[i].position.copy(this.trailBuffer[i]);
                this.ghosts[i].visible = true;
            } else {
                this.ghosts[i].visible = false;
            }
        }
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.scene.remove(this.mesh);

        this.chainSegments.forEach(s => {
            s.geometry.dispose();
            s.material.dispose();
            this.scene.remove(s);
        });

        this.ghosts.forEach(g => {
            g.geometry.dispose();
            g.material.dispose();
            this.scene.remove(g);
        });
    }
}
