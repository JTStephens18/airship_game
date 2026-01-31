import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export class ThreeEngine {
    constructor(container) {
        this.container = container;
        this.renderer = new THREE.WebGPURenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.z = 3;

        // Cube with NodeMaterial
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        this.material = new THREE.MeshStandardNodeMaterial();
        
        // Reactive uniform for color
        this.colorUniform = uniform(new THREE.Color(0x00ff00));
        this.material.colorNode = this.colorUniform;

        this.cube = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.cube);

        // Lighting
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        this.directionalLight.position.set(2, 2, 2);
        this.scene.add(this.directionalLight);
        
        this.ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(this.ambientLight);

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
        this.cube.rotation.x += 0.01;
        this.cube.rotation.y += 0.01;

        this.renderer.render(this.scene, this.camera);
    }

    updateControls(controls) {
        if (this.cube) {
            this.cube.scale.setScalar(controls.scale);
            // Updating uniform directly
            this.colorUniform.value.set(controls.color);
        }
        if (this.directionalLight) {
            this.directionalLight.intensity = controls.lightIntensity;
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
        this.renderer.dispose();
        
        if (this.container && this.renderer.domElement && this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}
