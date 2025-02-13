import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BaseScene } from '../BaseScene';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderMaterial, Vector3, AdditiveBlending, Color } from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer';
import { GUI } from 'dat.gui';
import { KeyboardState } from '../../utils/KeyboardState';

// Enhanced physics computation shader
const computeShaderPosition = `
  uniform float deltaTime;
  uniform float time;
  uniform vec3 blackHolePosition;
  uniform float blackHoleMass;
  
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);
    
    // Kepler orbital mechanics
    float r = length(pos.xyz - blackHolePosition);
    float v = length(vel.xyz);
    
    // Gravitational force with relativistic effects
    float G = 6.67430e-11;
    vec3 dir = normalize(blackHolePosition - pos.xyz);
    float force = G * blackHoleMass / (r * r);
    
    // Apply dark matter halo effect (NFW profile)
    float rs = 20.0; // Scale radius
    float rho0 = 0.1; // Characteristic density
    float darkMatterForce = 4.0 * PI * G * rho0 * rs * rs * rs * 
      (log(1.0 + r/rs) - (r/rs)/(1.0 + r/rs)) / (r * r);
    
    // Density wave theory
    float spiral = sin(atan(pos.z, pos.x) * 4.0 - r * 0.02 + time * 0.1);
    float density = smoothstep(-1.0, 1.0, spiral) * 0.5;
    
    // Update velocity with all forces
    vel.xyz += (dir * (force + darkMatterForce) + density * vec3(0.1)) * deltaTime;
    
    // Apply gas dynamics
    float pressure = 1.0 / r;
    vel.xyz += -normalize(vel.xyz) * pressure * deltaTime;
    
    // Update position
    pos.xyz += vel.xyz * deltaTime;
    
    // Enforce galactic disk constraints
    float height = abs(pos.y);
    if(height > 10.0) {
      pos.y *= 0.95;
      vel.y *= -0.5;
    }
    
    gl_FragColor = pos;
  }
`;

// Enhanced star shader
const enhancedStarShader = {
  uniforms: {
    time: { value: 0 },
    audioIntensity: { value: 0 },
    starTexture: { value: null },
    starMass: { value: 0.0 },
    starAge: { value: 0.0 },
    starMetallicity: { value: 0.0 },
    dustDensity: { value: 0.0 }
  },
  vertexShader: `
    attribute float size;
    attribute float temperature;
    attribute float mass;
    attribute float age;
    attribute float metallicity;
    varying vec2 vUv;
    varying float vAlpha;
    varying float vDistance;
    varying float vMass;
    varying float vAge;
    varying float vMetallicity;
    
    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float distance = length(mvPosition.xyz);
      
      // Reduced size scaling
      gl_PointSize = size * (500.0 / distance); // Reduced from 1500.0
      
      // Adjust fade distance for smaller stars
      vAlpha = smoothstep(8000.0, 500.0, distance);
      
      gl_Position = projectionMatrix * mvPosition;
      vDistance = -mvPosition.z;
      vMass = mass;
      vAge = age;
      vMetallicity = metallicity;
    }
  `,
  fragmentShader: `
    uniform sampler2D starTexture;
    uniform float time;
    uniform float audioIntensity;
    varying vec2 vUv;
    varying float vAlpha;
    varying float vDistance;
    varying float vMass;
    varying float vAge;
    varying float vMetallicity;
    
    void main() {
      // Sample star texture
      vec2 uv = gl_PointCoord;
      vec4 texColor = texture2D(starTexture, uv);
      
      // Enhanced glow effect
      float distanceToCenter = length(uv - vec2(0.5));
      float glow = exp(-distanceToCenter * 2.0);
      
      // Subtle scintillation effect
      float twinkle = sin(time * 0.5 + gl_FragCoord.x * 0.1) * 0.5 + 0.5;
      twinkle *= sin(time * 0.5 + gl_FragCoord.y * 0.1) * 0.5 + 0.5;
      
      // Combine colors with glow and twinkle
      vec3 finalColor = texColor.rgb + glow * 0.5;
      finalColor += finalColor * twinkle * 0.2;
      
      // Natural pulsation effect
      float pulsation = sin(time * 0.5 + gl_FragCoord.x * 0.01 + gl_FragCoord.y * 0.01) * 0.15 + 0.85;
      
      // Combine with existing twinkle effect
      float combinedEffect = twinkle * 0.3 + pulsation * 0.7;
      
      // Apply to final color
      finalColor *= combinedEffect;
      gl_FragColor = vec4(finalColor, texColor.a * vAlpha * (combinedEffect * 0.5 + 0.5));
    }
  `
};

export class GalaxyScene extends BaseScene {
    private particles: THREE.Points;
    private core: THREE.Mesh;
    private controls: OrbitControls;
    private composer: EffectComposer;
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private dataArray: Uint8Array;
    private isAudioConnected: boolean = false;
    private time: number = 0;

    private params = {
        galaxy: {
            armCount: 5,
            armWidth: 0.3,
            spiralFactor: 1.5,
            particleCount: 100000,
            size: 1000,
            randomness: 0.2,
            colorShift: 0.5,
            coreSize: 100,
            coreIntensity: 2.0,
            dustDensity: 0.5
        },
        colors: {
            core: new THREE.Color(0xffaa55),
            arms: new THREE.Color(0x0066ff),
            dust: new THREE.Color(0xff5500)
        },
        animation: {
            rotationSpeed: 0.1,
            pulseIntensity: 0.3,
            audioReactivity: 1.0
        }
    };

    constructor() {
        super();
        this.camera.position.set(0, 1000, 2000);
        this.camera.lookAt(0, 0, 0);
        
        // Initialize controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    init(): void {
        // Setup post-processing
        this.setupPostProcessing();
        
        // Create galaxy
        this.createGalaxy();
        this.createGalaxyCore();
        
        // Setup GUI
        this.setupGUI();
        
        // Setup audio context if needed
        try {
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        } catch (error) {
            console.warn('Audio context not supported:', error);
        }
    }

    private setupGUI(): void {
        const gui = new GUI();
        
        const galaxyFolder = gui.addFolder('Galaxy Structure');
        galaxyFolder.add(this.params.galaxy, 'armCount', 2, 8, 1)
            .name('Spiral Arms')
            .onChange(() => this.createGalaxy());
        galaxyFolder.add(this.params.galaxy, 'armWidth', 0.1, 1.0)
            .name('Arm Width')
            .onChange(() => this.createGalaxy());
        galaxyFolder.add(this.params.galaxy, 'spiralFactor', 0.5, 3)
            .name('Spiral Tightness')
            .onChange(() => this.createGalaxy());
        galaxyFolder.add(this.params.galaxy, 'randomness', 0, 1)
            .name('Star Spread')
            .onChange(() => this.createGalaxy());
        galaxyFolder.add(this.params.galaxy, 'dustDensity', 0, 1)
            .name('Dust Density')
            .onChange(() => {
                if (this.particles?.material instanceof THREE.ShaderMaterial) {
                    this.particles.material.uniforms.dustDensity.value = this.params.galaxy.dustDensity;
                }
            });

        const animationFolder = gui.addFolder('Animation');
        animationFolder.add(this.params.animation, 'rotationSpeed', 0, 0.5)
            .name('Rotation Speed')
            .onChange(() => {
                if (this.particles?.material instanceof THREE.ShaderMaterial) {
                    this.particles.material.uniforms.rotationSpeed.value = this.params.animation.rotationSpeed;
                }
            });
        animationFolder.add(this.params.animation, 'pulseIntensity', 0, 1)
            .name('Pulse Strength')
            .onChange(() => {
                if (this.particles?.material instanceof THREE.ShaderMaterial) {
                    this.particles.material.uniforms.pulseIntensity.value = this.params.animation.pulseIntensity;
                }
            });

        galaxyFolder.open();
        animationFolder.open();
    }

    animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        
        this.time += 0.016;
        
        if (this.particles?.material instanceof THREE.ShaderMaterial) {
            // Update time uniform
            this.particles.material.uniforms.time.value = this.time * this.params.animation.rotationSpeed;
            
            // Update audio reactivity
            if (this.isAudioConnected && this.analyser) {
                this.analyser.getByteFrequencyData(this.dataArray);
                const audioIntensity = Array.from(this.dataArray).reduce((a, b) => a + b, 0) / 
                                     (this.dataArray.length * 255);
                this.particles.material.uniforms.audioIntensity.value = 
                    audioIntensity * this.params.animation.audioReactivity;
            }
        }

        if (this.core?.material instanceof THREE.ShaderMaterial) {
            this.core.material.uniforms.time.value = this.time;
            // Update pulse intensity
            this.core.material.uniforms.intensity.value = 
                this.params.galaxy.coreIntensity * (1 + Math.sin(this.time * 2) * this.params.animation.pulseIntensity);
        }

        this.controls.update();
        this.composer.render();
    }

    private setupPostProcessing(): void {
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          1.5,  // Bloom strength
          0.4,  // Radius
          0.85  // Threshold
        );
        this.composer.addPass(bloomPass);
    }

    private createGalaxy(): void {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.params.galaxy.particleCount * 3);
        const colors = new Float32Array(this.params.galaxy.particleCount * 3);
        const sizes = new Float32Array(this.params.galaxy.particleCount);

        for(let i = 0; i < this.params.galaxy.particleCount; i++) {
            const i3 = i * 3;
            
            // Calculate arm angle based on number of arms
            const armAngle = (i % this.params.galaxy.armCount) * 
                           (2 * Math.PI / this.params.galaxy.armCount);
            
            // Calculate radius with arm width variation
            const radius = Math.random() * this.params.galaxy.size;
            const armOffset = (Math.random() - 0.5) * this.params.galaxy.armWidth * radius;
            
            // Apply spiral factor
            const spiralAngle = (radius / this.params.galaxy.size) * 
                               this.params.galaxy.spiralFactor * Math.PI * 2;
            const totalAngle = armAngle + spiralAngle;

            // Add randomness based on parameter
            const randomOffset = (Math.random() - 0.5) * this.params.galaxy.randomness * radius;
            
            positions[i3] = Math.cos(totalAngle) * (radius + armOffset) + randomOffset;
            positions[i3 + 1] = (Math.random() - 0.5) * radius * 0.1; // Thickness
            positions[i3 + 2] = Math.sin(totalAngle) * (radius + armOffset) + randomOffset;

            // Color gradient from center to edge with color shift
            const distanceFromCenter = radius / this.params.galaxy.size;
            const baseColor = new THREE.Color().lerpColors(
                this.params.colors.core,
                this.params.colors.arms,
                distanceFromCenter * this.params.galaxy.colorShift
            );

            colors[i3] = baseColor.r;
            colors[i3 + 1] = baseColor.g;
            colors[i3 + 2] = baseColor.b;

            // Size variation based on position
            sizes[i] = Math.max(2, (1 - distanceFromCenter) * 4);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                audioIntensity: { value: 0 },
                rotationSpeed: { value: this.params.animation.rotationSpeed },
                pulseIntensity: { value: this.params.animation.pulseIntensity },
                dustDensity: { value: this.params.galaxy.dustDensity }
            },
            vertexShader: `
                uniform float time;
                uniform float audioIntensity;
                uniform float rotationSpeed;
                uniform float pulseIntensity;
                attribute float size;
                varying vec3 vColor;

                void main() {
                    vColor = color;
                    vec3 pos = position;
                    
                    // Rotation based on parameter
                    float angle = time * rotationSpeed;
                    float x = pos.x * cos(angle) - pos.z * sin(angle);
                    float z = pos.x * sin(angle) + pos.z * cos(angle);
                    pos.x = x;
                    pos.z = z;

                    // Pulse effect based on parameter
                    float pulse = sin(time * 2.0) * pulseIntensity;
                    pos *= 1.0 + pulse * 0.1;

                    // Audio reactivity
                    float displacement = sin(time + length(position) * 0.02) * audioIntensity * 10.0;
                    pos += normalize(position) * displacement;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * (1.0 + audioIntensity * 0.5) * (1500.0 / length(mvPosition.xyz));
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                uniform float dustDensity;

                void main() {
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    float alpha = (1.0 - smoothstep(0.4, 0.5, dist)) * dustDensity;
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true
        });

        if (this.particles) {
            this.scene.remove(this.particles);
        }

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    private createGalaxyCore(): void {
        const coreGeometry = new THREE.SphereGeometry(this.params.galaxy.coreSize, 32, 32);
        const coreMaterial = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            intensity: { value: this.params.galaxy.coreIntensity }
          },
          vertexShader: `
            varying vec3 vNormal;
            void main() {
              vNormal = normal;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            uniform float intensity;
            varying vec3 vNormal;
            void main() {
              float pulse = 1.0 + sin(time * 2.0) * 0.2;
              float glow = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0) * intensity * pulse;
              vec3 color = mix(vec3(1.0, 0.7, 0.3), vec3(1.0, 0.4, 0.1), glow);
              gl_FragColor = vec4(color, glow);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide
        });

        this.core = new THREE.Mesh(coreGeometry, coreMaterial);
        this.scene.add(this.core);
    }
} 