import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Planet } from './Planet.js';
import { Player } from './Player.js';
import { AirshipController } from './AirshipController.js';
import { EnemyManager } from './EnemyManager.js';
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
            onPositionUpdate: (pos) => {
                // Keep the planet centered on the player (optional logic)
            }
        });

        // Planet integration
        this.planet = new Planet(this.scene);

        // Enemy system
        this.enemyManager = new EnemyManager(this.scene);
        this.gameState = new GameState({
            onHealthChange: (health, max) => {
                if (this.onHealthChange) this.onHealthChange(health, max);
            },
            onScoreChange: (score) => {
                if (this.onScoreChange) this.onScoreChange(score);
            },
            onGameOver: (score) => {
                if (this.onGameOver) this.onGameOver(score);
                this.enemyManager.isActive = false;
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

        // Enemy system updates
        if (this.enemyManager && !this.gameState.isGameOver) {
            this.enemyManager.update(delta, this.player.position, this.gameState);

            const enemies = this.enemyManager.getEnemies();

            // Anchor collision detection
            if (this.controller && this.controller.anchor) {
                const hits = this.controller.anchor.checkCollisions(enemies);
                for (const enemy of hits) {
                    const killed = enemy.takeDamage(1);
                    if (killed) {
                        this.gameState.addScore(100);
                    }
                }
            }

            // Player collision (ram damage)
            this.damageCooldown = Math.max(0, this.damageCooldown - delta);
            if (this.damageCooldown <= 0) {
                for (const enemy of enemies) {
                    if (enemy.checkCollision(this.player.position, 0.3)) {
                        this.gameState.takeDamage(enemy.damage);
                        this.damageCooldown = 1.0; // 1 second invulnerability
                        break;
                    }
                }
            }
        }

        if (this.planet) {
            // Terrain follows camera position
            this.planet.uniforms.uCameraPosition.value.copy(this.camera.position);
            this.renderer.compute(this.planet.computeUpdate);
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateControls(controls) {
        if (this.controls) {
            this.controls.enabled = controls.debug || false;
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

        if (this.controller && this.camera) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const target = new THREE.Vector3();
            // Raycast against the plane at ship height (approx)
            if (this.raycaster.ray.intersectPlane(this.mousePlane, target)) {
                this.controller.updateMouse(target);
            }
        }
    }

    restart() {
        // Reset game state
        this.gameState.reset();
        this.enemyManager.reset();
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
        if (this.enemyManager) this.enemyManager.dispose();
        if (this.controls) this.controls.dispose();
        this.renderer.dispose();

        if (this.container && this.renderer.domElement && this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
