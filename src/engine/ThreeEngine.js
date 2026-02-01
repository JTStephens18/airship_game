import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Planet } from './Planet.js';
import { Player } from './Player.js';
import { AirshipController } from './AirshipController.js';
import { GameState } from './GameState.js';


export class ThreeEngine {
    constructor(container) {
        this.container = container;
        this.renderer = new THREE.WebGPURenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();

        // Skybox loading
        const loader = new THREE.TextureLoader();
        const skyTex = loader.load('/src/assets/sky2.png');
        skyTex.mapping = THREE.EquirectangularReflectionMapping;
        skyTex.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = skyTex;

        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 15, 10);
        this.clock = new THREE.Clock();

        // Cube with NodeMaterial
        const geometry = new THREE.BoxGeometry(10, 10, 10);
        this.material = new THREE.MeshStandardNodeMaterial();

        // Reactive uniform for color
        this.colorUniform = uniform(new THREE.Color(0x00ff00));
        this.material.colorNode = this.colorUniform;

        this.cube = new THREE.Mesh(geometry, this.material);
        // this.scene.add(this.cube); // Center cube removed

        // Player & Controller setup
        this.player = new Player(this.scene);
        this.player.position.set(0, 10, 0); // Start high

        this.controller = new AirshipController(this.player, this.camera, {
            camOffset: [0, 2, 5], // Moved camera closer from [0, 3, 7]
            onPositionUpdate: (pos) => {
                // Keep the planet centered on the player (optional logic)
            }
        });

        // Planet integration
        this.planet = new Planet(this.scene);

        this.gameState = new GameState({
            onGameOver: (score) => {
                if (this.onGameOver) this.onGameOver(score);
            }
        });

        // Damage cooldown to prevent instant death
        this.damageCooldown = 0;

        // Lighting
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        this.directionalLight.position.set(2, 2, 2);
        this.scene.add(this.directionalLight);

        this.ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(this.ambientLight);

        // OrbitControls setup
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enabled = false; // Disabled by default

        this.onResize = this.onResize.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);

        window.addEventListener('resize', this.onResize);
        window.addEventListener('mousemove', this.onMouseMove);

        // Plane for mouse raycasting
        this.mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -10);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.isInitialized = false;
        this.init();
    }

    async init() {
        // REQUIRED before any rendering in WebGPU
        await this.renderer.init();
        this.isInitialized = true;
        this.animate();
    }

    animate() {
        if (!this.isInitialized) return;
        const delta = this.clock ? this.clock.getDelta() : 0.016;
        this.animationId = requestAnimationFrame(() => this.animate());

        // Independent animation loop
        if (this.controls && this.controls.enabled) {
            this.controls.update();
        } else {
            // Update controller when NOT in debug/orbit mode
            if (this.controller) {
                this.controller.update(delta);
            }
        }

        const totalTime = this.clock ? this.clock.elapsedTime : 0;

        if (this.player) {
            // Player bobbing is handled inside controller.update call to player.update, 
            // but we need to pass time for particles
            const bobAmount = Math.sin(totalTime * 3) * 0.1;
            this.player.update(delta, totalTime, bobAmount);
        }

        if (this.planet) {
            // Terrain follows camera position
            this.planet.uniforms.uCameraPosition.value.copy(this.camera.position);

            // Update shadow position and rotation from player
            if (this.player) {
                this.planet.uniforms.uShadowPosition.value.copy(this.player.position);
                this.planet.uniforms.uShadowRotation.value = this.player.rotation.y;
            }

            this.renderer.compute(this.planet.computeUpdate);
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateControls(controls) {
        if (this.controls) {
            this.controls.enabled = controls.debug || false;
        }

        if (this.player && controls.engineOffsetX !== undefined) {
            this.player.engineOffsets[0].set(controls.engineOffsetX, controls.engineOffsetY, controls.engineOffsetZ);
            this.player.engineOffsets[1].set(-controls.engineOffsetX, controls.engineOffsetY, controls.engineOffsetZ);

            if (controls.smokeSize !== undefined) {
                this.player.smokeTrails.forEach(t => t.setSize(controls.smokeSize));
            }
            if (controls.spawnRate !== undefined) {
                this.player.smokeTrails.forEach(t => t.setSpawnRate(controls.spawnRate));
            }
        }

        if (this.cube) {
            if (controls.scale !== undefined) this.cube.scale.setScalar(controls.scale);
            if (controls.color !== undefined) this.colorUniform.value.set(controls.color);
        }
        if (this.directionalLight) {
            if (controls.lightIntensity !== undefined) this.directionalLight.intensity = controls.lightIntensity;
        }
        if (this.planet) {
            this.planet.updateControls(controls);
        }
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    restart() {
        // Reset game state
        this.gameState.reset();
        this.damageCooldown = 0;

        // Reset player position
        this.player.position.set(0, 10, 0);

        // Reset camera
        this.camera.position.set(0, 15, 10);
    }

    dispose() {
        this.isInitialized = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('mousemove', this.onMouseMove);

        // Cleanup resources
        this.cube.geometry.dispose();
        this.cube.material.dispose();
        if (this.planet) this.planet.dispose();
        if (this.controls) this.controls.dispose();
        this.renderer.dispose();

        if (this.container && this.renderer.domElement && this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
