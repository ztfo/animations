import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BaseScene } from '../BaseScene';

export class CubeScene extends BaseScene {
  private cube: THREE.Mesh;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor() {
    super();
    this.cube = new THREE.Mesh();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Initialize controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // Smooth camera movement

    // Add mouse move listener
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    // Add click listener
    window.addEventListener('click', this.onClick.bind(this));
  }

  init(): void {
    // Create a simple cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshPhongMaterial({ 
      color: 0x00ff00,
      // Add hover effect support
      emissive: 0x000000,
      emissiveIntensity: 1
    });
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

  private onMouseMove(event: MouseEvent): void {
    // Calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObject(this.cube);

    if (intersects.length > 0) {
      // Mouse is hovering over the cube
      (this.cube.material as THREE.MeshPhongMaterial).emissive.setHex(0x333333);
    } else {
      // Mouse is not hovering over the cube
      (this.cube.material as THREE.MeshPhongMaterial).emissive.setHex(0x000000);
    }
  }

  private onClick(event: MouseEvent): void {
    // Update the picking ray with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObject(this.cube);

    if (intersects.length > 0) {
      // Cube was clicked - change its color randomly
      const randomColor = Math.random() * 0xffffff;
      (this.cube.material as THREE.MeshPhongMaterial).color.setHex(randomColor);
    }
  }

  animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    // Update controls
    this.controls.update();

    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }
} 