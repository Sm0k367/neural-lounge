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
        
        // INTERPOLATE between current position and target
        vec3 pos = mix(position, aTarget, uMorph);
        
        // EXPLOSION & BASS JITTER
        if(uMorph > 0.05) {
            pos += aVelocity * uMorph * 250.0;
            pos.x += sin(uTime * 12.0 + pos.y) * uAudio * 25.0;
            pos.z += cos(uTime * 12.0 + pos.x) * uAudio * 25.0;
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (2.5 + uAudio * 6.0) * (400.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    uniform float uAudio;
    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        vec3 glowColor = vColor * (1.8 + uAudio * 6.0);
        gl_FragColor = vec4(glowColor, smoothstep(0.5, 0.1, d));
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1200; // Start further back for the "assemble" zoom

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    await startNeuralAssembly();
    animate();
}

async function startNeuralAssembly() {
    const loader = new FontLoader();
    // Use the official Three.js font URL for reliability
    const font = await loader.loadAsync('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json');
    
    const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font: font, size: 65, height: 2, curveSegments: 25 });
    textGeo.center();

    const count = 65000;
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

        // INITIAL STATE: Scattered Dust in a massive 3D sphere
        positions[i3] = (Math.random() - 0.5) * 3500;
        positions[i3+1] = (Math.random() - 0.5) * 3500;
        positions[i3+2] = (Math.random() - 0.5) * 3500;

        // TARGET STATE: The Letters
        targets[i3] = sampler.getX(rIdx);
        targets[i3+1] = sampler.getY(rIdx);
        targets[i3+2] = sampler.getZ(rIdx);

        // Explosion trajectory for later
        velocities[i3] = (Math.random() - 0.5) * 12;
        velocities[i3+1] = (Math.random() - 0.5) * 12;
        velocities[i3+2] = (Math.random() - 0.5) * 12;

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

    // --- ANIMATION SEQUENCE ---
    const tl = gsap.timeline();
    
    // Zoom in while flying from dust to text
    tl.to(camera.position, { z: 700, duration: 4, ease: "power2.inOut" });
    tl.to(positions, {
        endArray: targets,
        duration: 4,
        ease: "power3.inOut",
        onUpdate: () => geo.attributes.position.needsUpdate = true,
        onComplete: () => {
            document.getElementById('click-hint').style.display = 'block';
            window.addEventListener('mousedown', enterLounge);
        }
    }, 0);
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
    ctx.resume();
    audio.play();

    // Trigger Explosion Morph
    gsap.to(particleSystem.material.uniforms.uMorph, { value: 1, duration: 3, ease: "expo.out" });
    document.getElementById('now-playing').innerText = "SYSTEM_SYNC // TRACK_01";
}

window.switchTrack = function() {
    const old = document.getElementById(`audio-${currentTrack}`);
    old.pause(); old.currentTime = 0;
    currentTrack = currentTrack >= 3 ? 1 : currentTrack + 1;
    const next = document.getElementById(`audio-${currentTrack}`);
    next.play();
    document.getElementById('now-playing').innerText = `SYSTEM_SYNC // TRACK_0${currentTrack}`;
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
            particleSystem.material.uniforms.uAudio.value = avg / 28.0;
            // Link progress line to bass frequency for a flashy effect
            document.getElementById('progress-line').style.width = Math.min(avg * 2, 100) + "%";
        }
    }
    renderer.render(scene, camera);
}

init();
