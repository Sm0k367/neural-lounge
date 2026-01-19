import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, particleSystem, analyzer, clock;
let isPlaying = false;
let currentTrack = 1;

// --- DYNAMIC SHADERS ---
const vertexShader = `
    uniform float uTime;
    uniform float uMorph;
    uniform float uAudio;
    attribute vec3 aTarget;
    attribute vec3 aVelocity;
    varying vec3 vColor;

    void main() {
        vColor = color;
        
        // INTERPOLATE between original text position and morphed audio state
        vec3 pos = mix(position, aTarget, uMorph);
        
        // ADD EXPLOSION & AUDIO JITTER
        if(uMorph > 0.1) {
            pos += aVelocity * uMorph * 200.0;
            pos.x += sin(uTime * 10.0 + pos.y) * uAudio * 20.0;
            pos.z += cos(uTime * 10.0 + pos.x) * uAudio * 20.0;
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (2.0 + uAudio * 5.0) * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    uniform float uAudio;
    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        vec3 glowColor = vColor * (1.5 + uAudio * 5.0);
        gl_FragColor = vec4(glowColor, smoothstep(0.5, 0.2, d));
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.z = 800;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    loadNeuralText();
    animate();
}

function loadNeuralText() {
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font: font, size: 60, height: 2, curveSegments: 20 });
        textGeo.center();

        const count = 60000;
        const positions = new Float32Array(count * 3);
        const targets = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        const sampler = textGeo.attributes.position;
        const p1 = new THREE.Color(0xbc00ff); // Purple
        const p2 = new THREE.Color(0x00f2ff); // Blue

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const rIdx = Math.floor(Math.random() * sampler.count);

            // Starting scattered (The Dust)
            positions[i3] = (Math.random() - 0.5) * 2000;
            positions[i3+1] = (Math.random() - 0.5) * 2000;
            positions[i3+2] = (Math.random() - 0.5) * 2000;

            // Target (The Text)
            targets[i3] = sampler.getX(rIdx);
            targets[i3+1] = sampler.getY(rIdx);
            targets[i3+2] = sampler.getZ(rIdx);

            velocities[i3] = (Math.random() - 0.5) * 10;
            velocities[i3+1] = (Math.random() - 0.5) * 10;
            velocities[i3+2] = (Math.random() - 0.5) * 10;

            const c = p1.clone().lerp(p2, Math.random());
            colors[i3] = c.r; colors[i3+1] = c.g; colors[i3+2] = c.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aTarget', new THREE.BufferAttribute(targets, 3));
        geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uMorph: { value: 0 }, uAudio: { value: 0 } },
            vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
        });

        particleSystem = new THREE.Points(geo, mat);
        scene.add(particleSystem);

        // PHASE 1: ASSEMBLE TEXT
        gsap.to(particleSystem.position, { z: 100, duration: 4, ease: "power2.out" });
        // Reverse morph: fly from dust into targets
        gsap.to(geo.attributes.position.array, {
            endArray: targets,
            duration: 3,
            onUpdate: () => geo.attributes.position.needsUpdate = true,
            onComplete: () => { document.getElementById('click-hint').style.display = 'block'; }
        });

        window.addEventListener('mousedown', enterLounge);
    });
}

function enterLounge() {
    if (isPlaying) return;
    isPlaying = true;
    document.getElementById('click-hint').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';

    const audio = document.getElementById(`audio-${currentTrack}`);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaElementSource(audio);
    analyzer = ctx.createAnalyser();
    source.connect(analyzer);
    analyzer.connect(ctx.destination);
    audio.play();

    // PHASE 2: EXPLODE & MORPH
    gsap.to(particleSystem.material.uniforms.uMorph, { value: 1, duration: 2, ease: "expo.out" });
    document.getElementById('now-playing').innerText = "STREAMING: TRACK_01";
}

window.switchTrack = function() {
    const old = document.getElementById(`audio-${currentTrack}`);
    old.pause(); old.currentTime = 0;
    currentTrack = currentTrack >= 3 ? 1 : currentTrack + 1;
    document.getElementById(`audio-${currentTrack}`).play();
    document.getElementById('now-playing').innerText = `STREAMING: TRACK_0${currentTrack}`;
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
            particleSystem.material.uniforms.uAudio.value = avg / 25.0;
            document.getElementById('progress-line').style.width = (avg*1.5) + "%"; // Visualizer bar
        }
    }
    renderer.render(scene, camera);
}
init();
