import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, particleSystem, analyzer, clock;
let isPlaying = false;
let currentTrackIndex = 1;

// --- DYNAMIC MULTI-MODE SHADER ---
const vertexShader = `
    uniform float uTime;
    uniform float uExplode;
    uniform float uAudio;
    uniform int uMode; 
    attribute vec3 aTarget;
    attribute vec3 aVelocity;
    varying vec3 vColor;

    void main() {
        vColor = color;
        vec3 pos = mix(position, aTarget, clamp(uExplode * 0.5, 0.0, 1.0));

        if(uExplode > 0.1) {
            // MODE 1: MELLOW NEBULA (Track 1)
            if(uMode == 1) {
                pos += aVelocity * uExplode * 200.0;
                pos.x += sin(uTime * 0.5 + pos.y * 0.01) * uAudio * 30.0;
                pos.y += cos(uTime * 0.5 + pos.x * 0.01) * uAudio * 30.0;
            } 
            // MODE 2: THE VORTEX (Track 2)
            else if(uMode == 2) {
                float angle = uTime * 0.2 + length(pos.xz) * 0.01;
                pos.x += cos(angle) * uAudio * 40.0;
                pos.z += sin(angle) * uAudio * 40.0;
                pos.y += sin(uTime + pos.x) * uAudio * 10.0;
            }
            // MODE 3: WAVELENGTH (Track 3)
            else {
                pos += aVelocity * uExplode * 100.0;
                pos.z += sin(pos.x * 0.02 + uTime * 2.0) * uAudio * 50.0;
                pos.y += cos(pos.z * 0.02 + uTime * 2.0) * uAudio * 50.0;
            }
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (1.8 + uAudio * 4.0) * (500.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    uniform float uAudio;
    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        vec3 glow = vColor * (1.2 + uAudio * 5.0);
        gl_FragColor = vec4(glow, smoothstep(0.5, 0.1, d));
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1500;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const loader = new FontLoader();
    const font = await loader.loadAsync('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json');
    
    setupParticles(font);
    animate();
}

function setupParticles(font) {
    const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 60, height: 1, curveSegments: 30 });
    textGeo.center();

    const count = 80000; // Ultra high density for readability
    const positions = new Float32Array(count * 3);
    const targets = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const sampler = textGeo.attributes.position;
    const c1 = new THREE.Color(0xbc00ff);
    const c2 = new THREE.Color(0x00f2ff);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const rIdx = Math.floor(Math.random() * sampler.count);

        positions[i3] = (Math.random() - 0.5) * 4000;
        positions[i3+1] = (Math.random() - 0.5) * 4000;
        positions[i3+2] = (Math.random() - 0.5) * 4000;

        targets[i3] = sampler.getX(rIdx);
        targets[i3+1] = sampler.getY(rIdx);
        targets[i3+2] = sampler.getZ(rIdx);

        velocities[i3] = (Math.random() - 0.5) * 8;
        velocities[i3+1] = (Math.random() - 0.5) * 8;
        velocities[i3+2] = (Math.random() - 0.5) * 8;

        const c = c1.clone().lerp(c2, Math.random());
        colors[i3] = c.r; colors[i3+1] = c.g; colors[i3+2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(targets, 3));
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uExplode: { value: 0 }, uAudio: { value: 0 }, uMode: { value: 1 } },
        vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
    });

    particleSystem = new THREE.Points(geo, mat);
    scene.add(particleSystem);

    // Cinematic Intro
    const tl = gsap.timeline();
    tl.to(camera.position, { z: 850, duration: 4, ease: "expo.inOut" });
    tl.to(positions, {
        endArray: targets, duration: 4, ease: "power3.inOut",
        onUpdate: () => geo.attributes.position.needsUpdate = true,
        onComplete: () => {
            document.getElementById('click-hint').style.display = 'block';
            window.addEventListener('mousedown', startExperience);
        }
    }, 0);
}

function startExperience() {
    if (isPlaying) return;
    isPlaying = true;
    document.getElementById('click-hint').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';

    playTrack(currentTrackIndex);
    gsap.to(particleSystem.material.uniforms.uExplode, { value: 1, duration: 3, ease: "power2.out" });
}

function playTrack(index) {
    const audio = document.getElementById(`audio-${index}`);
    if (!analyzer) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaElementSource(audio);
        analyzer = ctx.createAnalyser();
        source.connect(analyzer);
        analyzer.connect(ctx.destination);
    }
    audio.play();
    
    // Update Shader Mode
    particleSystem.material.uniforms.uMode.value = index;
    
    // Update UI
    const modes = ["NONE", "NEBULA FLOW", "VORTEX PULSE", "WAVELENGTH"];
    document.getElementById('now-playing').innerText = `SYSTEM_ACTIVE // TRACK_0${index}`;
    document.getElementById('visualizer-mode').innerText = `MODE: ${modes[index]}`;
}

window.switchTrack = function() {
    const oldAudio = document.getElementById(`audio-${currentTrackIndex}`);
    oldAudio.pause(); oldAudio.currentTime = 0;

    currentTrackIndex = currentTrackIndex >= 3 ? 1 : currentTrackIndex + 1;
    playTrack(currentTrackIndex);
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
            particleSystem.material.uniforms.uAudio.value = avg / 35.0;
            document.getElementById('progress-line').style.width = Math.min(avg * 2.5, 100) + "%";
        }
    }
    renderer.render(scene, camera);
}

init();
