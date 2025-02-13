import * as THREE from 'three';
import { BaseScene } from '../BaseScene';

export class CubeScene extends BaseScene {
  private cube: THREE.Mesh;

  constructor() {
    super();
    this.cube = new THREE.Mesh();
  }

  init(): void {
    // Create a simple cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    // Add lights
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(10, 10, 10);
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    // Position camera
    this.camera.position.z = 5;
  }

  animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    // Rotate the cube
    this.cube.rotation.x += 0.01;
    this.cube.rotation.y += 0.01;

    this.renderer.render(this.scene, this.camera);
  }
} 