import * as THREE from 'three';

export abstract class BaseScene {
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected renderer: THREE.WebGLRenderer;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  protected onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  abstract init(): void;
  abstract animate(): void;

  start(): void {
    this.init();
    this.animate();
  }
} 