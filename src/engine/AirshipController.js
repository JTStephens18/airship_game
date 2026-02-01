import * as THREE from 'three/webgpu';

/**
 * AirshipController - Hovercraft-style movement controller in Vanilla Three.js
 */
export class AirshipController {
    constructor(player, camera, options = {}) {
        this.player = player;
        this.camera = camera;

        this.baseSpeed = options.baseSpeed || 10;
        this.sprintMult = options.sprintMult || 2;
        this.turnSpeed = options.turnSpeed || 5;
        this.camOffset = new THREE.Vector3(...(options.camOffset || [0, 5, 10]));
        this.smoothTime = options.smoothTime || 0.2;
        this.onPositionUpdate = options.onPositionUpdate || null;

        // Flight limits
        this.minHeight = options.minHeight || 3;
        this.maxHeight = options.maxHeight || 20;
        this.verticalSpeed = options.verticalSpeed || 8;



        // State tracking
        this.currentVelocity = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.facingAngle = 0;
        this.facingDirection = new THREE.Vector3(0, 0, -1);
        this.bobTime = 0;

        // Camera smoothing state
        this.cameraTargetPos = new THREE.Vector3();
        this.cameraLookTarget = new THREE.Vector3();

        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            sprint: false,
            ascend: false,
            descend: false
        };

        this.setupInputs();
    }

    setupInputs() {
        window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
        window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
    }

    handleKey(code, isPressed) {
        switch (code) {
            case 'KeyW': this.keys.forward = isPressed; break;
            case 'KeyS': this.keys.backward = isPressed; break;
            case 'KeyA': this.keys.left = isPressed; break;
            case 'KeyD': this.keys.right = isPressed; break;
            case 'ShiftLeft': this.keys.sprint = isPressed; break;
            case 'Space': this.keys.ascend = isPressed; break;
            case 'KeyC': this.keys.descend = isPressed; break;
        }
    }


    update(delta) {
        if (!this.player) return;

        // === A. ROTATION ===
        if (this.keys.left) this.facingAngle += this.turnSpeed * delta;
        if (this.keys.right) this.facingAngle -= this.turnSpeed * delta;

        this.player.group.rotation.y = this.facingAngle;

        // Update facing direction
        this.facingDirection.set(0, 0, -1).applyQuaternion(this.player.quaternion);

        // === B. MOVEMENT ===
        let moveAmount = 0;
        if (this.keys.forward) moveAmount = 1;
        if (this.keys.backward) moveAmount = -1;

        const speed = this.keys.sprint ? this.baseSpeed * this.sprintMult : this.baseSpeed;
        this.targetVelocity.copy(this.facingDirection).multiplyScalar(moveAmount * speed);

        // Smoothing for inertia
        const dampFactor = 1 - Math.exp(-delta / this.smoothTime);
        this.currentVelocity.lerp(this.targetVelocity, dampFactor);

        // Vertical movement
        let verticalVel = 0;
        const currentY = this.player.position.y;
        if (this.keys.ascend && currentY < this.maxHeight) verticalVel = this.verticalSpeed;
        else if (this.keys.descend && currentY > this.minHeight) verticalVel = -this.verticalSpeed;

        // Apply movement to position (since we don't have Rapier here)
        this.player.position.x += this.currentVelocity.x * delta;
        this.player.position.y += verticalVel * delta;
        this.player.position.z += this.currentVelocity.z * delta;


        // === E. VISUAL BOBBING ===
        this.bobTime += delta;
        const bobAmount = Math.sin(this.bobTime * 3) * 0.1;
        this.player.update(bobAmount);

        // === D. CAMERA FOLLOW ===
        // Apply offset rotated by player rotation
        const offset = this.camOffset.clone().applyQuaternion(this.player.quaternion);
        this.cameraTargetPos.copy(this.player.position).add(offset);

        // Smooth follow
        const smoothFactor = 1 - Math.exp(-delta * 10);
        this.camera.position.lerp(this.cameraTargetPos, smoothFactor);

        this.cameraLookTarget.lerp(this.player.position, smoothFactor);
        this.camera.lookAt(this.cameraLookTarget);

        // === E. NOTIFY TERRAIN ===
        if (this.onPositionUpdate) {
            this.onPositionUpdate(this.player.position);
        }
    }
}
