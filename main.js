/**
 * NEURAL LOUNGE // MAX POTENTIAL V3.0
 * VIBRANT NEON & HIGH-READABILITY MORPH
 */

import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, particleSystem, analyzer, clock;
let isExploded = false;
let currentTrackIndex = 1;

// --- ENHANCED SHADERS ---
const vertexShader = `
    uniform float uTime;
    uniform float uExplode;
    uniform float uAudio;
    attribute vec3 aVelocity;
    attribute float aSize;
    varying vec3 vColor;
    varying float vDistance;

    void main() {
        vColor = color;
        vec3 pos = position;
        
        // EXPLOSION MATH
        // We use an exponential curve so the explosion starts fast and slows down
        float explosionStrength = pow(uExplode, 1.5);
        pos += aVelocity * explosionStrength * 800.0;
        
        // VIBRANT JITTER (Reacts to Audio Bass)
        if (uExplode > 0.1) {
            pos.x += sin(uTime * 15.0 + pos.y) * uAudio * 12.0;
            pos.y += cos(uTime * 15.0 + pos.x) * uAudio * 12.0;
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        
        // Particle size increases slightly with audio for "flash" effect
        float sizePulse = 1.0 + (uAudio * 0.5);
        gl_PointSize = (aSize * sizePulse) * (450.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    uniform float uAudio;

    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;

        // NEON BOOST: We multiply color by a brightness factor
        // This creates a "glow" effect when combined with AdditiveBlending
        float brightness = 1.5 + (uAudio * 3.0);
        vec3 neonColor = vColor * brightness;

        // Soft edges for a "light-bulb" feel
        float alpha = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(neonColor, alpha);
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.z = 600; // Moved back slightly for better text framing

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('main-view'), 
        antialias: true, 
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    loadParticles();
    animate();
}

function loadParticles() {
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const textGeo = new TextGeometry('NEURAL LOUNGE', {
            font: font,
            size: 70,
            height: 2,
            curveSegments: 20 // Smoother curves for better readability
        });
        textGeo.center();

        // Increased count to 50,000 for "Solid Text" look
        const count = 50000;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        // VIBRANT PALETTE: High-saturation Purple (#BC00FF)
        const purple = new THREE.Color(0xbc00ff);
        const blue = new THREE.Color(0x00f2ff);
        
        const sampler = textGeo.attributes.position;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const randomIdx = Math.floor(Math.random() * sampler.count);
            
            positions[i3] = sampler.getX(randomIdx);
            positions[i3+1] = sampler.getY(randomIdx);
            positions[i3+2] = sampler.getZ(randomIdx);

            // Outward velocity for explosion
            velocities[i3] = (Math.random() - 0.5) * 4;
            velocities[i3+1] = (Math.random() - 0.5) * 4;
            velocities[i3+2] = (Math.random() - 0.5) * 4;

            // Mix purple and blue for a "gradient neon" vibe
            const mixedColor = purple.clone().lerp(blue, Math.random() * 0.3);
            colors[i3] = mixedColor.r;
            colors[i3+1] = mixedColor.g;
            colors[i3+2] = mixedColor.b;

            sizes[i] = Math.random() * 2.0 + 1.0;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uExplode: { value: 0 },
                uAudio: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false, // Prevents particles from "cutting" each other
            vertexColors: true
        });

        particleSystem = new THREE.Points(geo, mat);
        scene.add(particleSystem);

        window.addEventListener('mousedown', startShow);
    });
}

function startShow() {
    if (isExploded) return;
    isExploded = true;

    const audio = document.getElementById(`audio-${currentTrackIndex}`);
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);
    analyzer = audioCtx.createAnalyser();
    source.connect(analyzer);
    analyzer.connect(audioCtx.destination);
    audio.play();

    // EXPLOSION GSAP
    gsap.to(particleSystem.material.uniforms.uExplode, {
        value: 1,
        duration: 2.5,
        ease: "expo.out"
    });

    document.getElementById('ui-layer').style.display = 'flex';
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (particleSystem) {
        particleSystem.material.uniforms.uTime.value = time;
        
        if (analyzer) {
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b) / data.length;
            // Map the average frequency to a 0.0 - 1.0 range for the shader
            particleSystem.material.uniforms.uAudio.value = avg / 35.0;
        }
    }

    renderer.render(scene, camera);
}

init();
