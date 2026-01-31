import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Planet } from './Planet.js';


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
        this.camera.position.z = 3;

        // Cube with NodeMaterial
        const geometry = new THREE.BoxGeometry(10, 10, 10);
        this.material = new THREE.MeshStandardNodeMaterial();

        // Reactive uniform for color
        this.colorUniform = uniform(new THREE.Color(0x00ff00));
        this.material.colorNode = this.colorUniform;

        this.cube = new THREE.Mesh(geometry, this.material);
        // this.scene.add(this.cube); // Center cube removed

        // Planet integration
        this.planet = new Planet(this.scene);

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
        window.addEventListener('resize', this.onResize);

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
        this.animationId = requestAnimationFrame(() => this.animate());

        // Independent animation loop
        if (this.controls && this.controls.enabled) {
            this.controls.update();
        } else {
            this.cube.rotation.x += 0.01;
            this.cube.rotation.y += 0.01;
        }

        if (this.planet) {
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

    dispose() {
        this.isInitialized = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        window.removeEventListener('resize', this.onResize);

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
