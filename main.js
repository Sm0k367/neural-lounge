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
        // Use a smoother mix for the transition
        vec3 pos = mix(position, aTarget, clamp(1.0 - uExplode, 0.0, 1.0));

        if(uExplode > 0.01) {
            // MODE 1: NEBULA (Track 1)
            if(uMode == 1) {
                pos += aVelocity * uExplode * 150.0;
                pos.x += sin(uTime * 0.4 + pos.y * 0.02) * uAudio * 25.0;
            } 
            // MODE 2: VORTEX (Track 2)
            else if(uMode == 2) {
                float r = length(pos.xz);
                float angle = uTime * 0.5 + r * 0.01;
                pos.x += cos(angle) * uAudio * 50.0;
                pos.z += sin(angle) * uAudio * 50.0;
            }
            // MODE 3: WAVELENGTH (Track 3)
            else {
                pos.z += sin(pos.x * 0.05 + uTime * 3.0) * uAudio * 60.0;
            }
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = (2.0 + uAudio * 5.0) * (600.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    uniform float uAudio;
    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor * (1.0 + uAudio * 4.0), 1.0 - (d * 2.0));
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 2000; // Start further out for a grander entrance

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('main-view'), 
        antialias: true, 
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const loader = new FontLoader();
    // Using a reliable CDN for the font to avoid local pathing errors on GitHub
    const font = await loader.loadAsync('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json');
    
    setupParticles(font);
    animate();
}

function setupParticles(font) {
    const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 55, height: 1, curveSegments: 12 });
    textGeo.center();

    const count = 70000;
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

        positions[i3] = (Math.random() - 0.5) * 5000;
        positions[i3+1] = (Math.random() - 0.5) * 5000;
        positions[i3+2] = (Math.random() - 0.5) * 5000;

        targets[i3] = sampler.getX(rIdx);
        targets[i3+1] = sampler.getY(rIdx);
        targets[i3+2] = sampler.getZ(rIdx);

        velocities[i3] = (Math.random() - 0.5) * 10;
        velocities[i3+1] = (Math.random() - 0.5) * 10;
        velocities[i3+2] = (Math.random() - 0.5) * 10;

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

    // INTRO ANIMATION: Fly into text
    gsap.to(camera.position, { z: 800, duration: 5, ease: "power4.inOut" });
    gsap.to(particleSystem.geometry.attributes.position.array, {
        endArray: targets,
        duration: 5,
        ease: "expo.inOut",
        onUpdate: () => particleSystem.geometry.attributes.position.needsUpdate = true,
        onComplete: () => {
            document.getElementById('click-hint').style.display = 'block';
            window.addEventListener('mousedown', startExperience, { once: true });
        }
    });
}

function startExperience() {
    isPlaying = true;
    document.getElementById('click-hint').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';

    // Transition uExplode from 0 (Text) to 1 (Visualizer)
    gsap.to(particleSystem.material.uniforms.uExplode, { value: 1, duration: 2.5, ease: "power2.out" });
    playTrack(currentTrackIndex);
}

function playTrack(index) {
    const audio = document.getElementById(`audio-${index}`);
    
    // Resume AudioContext for browser safety
    if (!analyzer) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(audio);
        analyzer = ctx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(ctx.destination);
    }
    
    audio.play();
    particleSystem.material.uniforms.uMode.value = index;
}

window.switchTrack = function() {
    const oldAudio = document.getElementById(`audio-${currentTrackIndex}`);
    oldAudio.pause(); 
    oldAudio.currentTime = 0;

    currentTrackIndex = (currentTrackIndex % 3) + 1;
    playTrack(currentTrackIndex);
};

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    if (particleSystem) {
        particleSystem.material.uniforms.uTime.value = time;
        if (analyzer && isPlaying) {
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            particleSystem.material.uniforms.uAudio.value = avg / 40.0;
            document.getElementById('progress-line').style.width = Math.min(avg * 2, 100) + "%";
        }
    }
    renderer.render(scene, camera);
}

init();
