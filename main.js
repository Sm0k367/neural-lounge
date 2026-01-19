/**
 * NEURAL LOUNGE // MAX POTENTIAL V2.0
 * MODULE-BASED PARTICLE SYSTEM & AUDIO SYNC
 */

import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, particleSystem, analyzer, clock;
let isExploded = false;
let currentTrackIndex = 1;

// --- SHADERS ---
const vertexShader = `
    uniform float uTime;
    uniform float uExplode;
    uniform float uAudio;
    attribute vec3 aVelocity;
    attribute float aSize;
    varying vec3 vColor;
    void main() {
        vColor = color;
        vec3 pos = position;
        
        // EXPLOSION LOGIC
        pos += aVelocity * uExplode * 600.0;
        
        // AUDIO VIBRATION
        pos.x += sin(uTime * 10.0 + pos.y) * uAudio * 5.0;
        pos.y += cos(uTime * 10.0 + pos.z) * uAudio * 5.0;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0 - (d * 2.0));
    }
`;

// --- INITIALIZATION ---
async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.z = 500;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    loadParticles();
    animate();
}

function loadParticles() {
    const loader = new FontLoader();
    // Loading from the official Three.js font hosting
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const textGeo = new TextGeometry('NEURAL LOUNGE', {
            font: font,
            size: 60,
            height: 5,
            curveSegments: 12
        });
        textGeo.center();

        const count = 30000;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        const coreColor = new THREE.Color(0xbc00ff);
        const sampler = textGeo.attributes.position;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const randomIdx = Math.floor(Math.random() * sampler.count);
            
            positions[i3] = sampler.getX(randomIdx);
            positions[i3+1] = sampler.getY(randomIdx);
            positions[i3+2] = sampler.getZ(randomIdx);

            velocities[i3] = (Math.random() - 0.5) * 3;
            velocities[i3+1] = (Math.random() - 0.5) * 3;
            velocities[i3+2] = (Math.random() - 0.5) * 3;

            colors[i3] = coreColor.r;
            colors[i3+1] = coreColor.g;
            colors[i3+2] = coreColor.b;

            sizes[i] = Math.random() * 1.5 + 0.5;
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

    // Trigger Audio
    const audio = document.getElementById(`audio-${currentTrackIndex}`);
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audio);
    analyzer = audioCtx.createAnalyser();
    source.connect(analyzer);
    analyzer.connect(audioCtx.destination);
    audio.play();

    // GSAP Explosion
    gsap.to(particleSystem.material.uniforms.uExplode, {
        value: 1,
        duration: 3,
        ease: "power4.out"
    });

    document.getElementById('ui-layer').style.display = 'flex';
    document.getElementById('track-name').innerText = `NOW STREAMING: TRACK ${currentTrackIndex}`;
}

// Ensure the switchTrack is global for the button
window.switchTrack = function() {
    const oldAudio = document.getElementById(`audio-${currentTrackIndex}`);
    oldAudio.pause();
    oldAudio.currentTime = 0;

    currentTrackIndex = currentTrackIndex >= 3 ? 1 : currentTrackIndex + 1;
    
    const newAudio = document.getElementById(`audio-${currentTrackIndex}`);
    newAudio.play();
    document.getElementById('track-name').innerText = `NOW STREAMING: TRACK ${currentTrackIndex}`;
};

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (particleSystem) {
        particleSystem.material.uniforms.uTime.value = time;
        
        if (analyzer) {
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b) / data.length;
            particleSystem.material.uniforms.uAudio.value = avg / 20.0;
        }
    }

    renderer.render(scene, camera);
}

init();
