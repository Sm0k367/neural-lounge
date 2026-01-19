import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, instancedMesh, analyzer, clock, audioCtx;
let isPlaying = false;
let currentTrackIndex = 1;
const dummy = new THREE.Object3D();

// --- NEON RAVE SHADERS ---
const vertexShader = `
    varying vec3 vColor;
    varying float vGlow;
    uniform float uTime;
    uniform float uAudio;
    void main() {
        vColor = color;
        vec3 pos = position;
        // The 420 Fluid Motion
        float drift = sin(uTime * 1.5 + instanceMatrix[3][2] * 0.05) * uAudio * 20.0;
        pos.x += drift;
        pos.y += cos(uTime * 1.5 + instanceMatrix[3][2] * 0.05) * uAudio * 10.0;
        
        vec4 mvPosition = instanceMatrix * vec4(pos, 1.0);
        vGlow = uAudio;
        gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    varying float vGlow;
    void main() {
        vec3 glow = vColor * (1.5 + vGlow * 12.0);
        gl_FragColor = vec4(glow, 0.85);
    }
`;

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1200; // Start far back for readability

    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('main-view'), 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 1. SETUP TUNNEL (Hidden)
    const ringGeo = new THREE.TorusGeometry(150, 1.8, 16, 40);
    const ringMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAudio: { value: 0 } },
        vertexShader, fragmentShader, transparent: true, blending: THREE.AdditiveBlending, vertexColors: true
    });

    const count = 450;
    instancedMesh = new THREE.InstancedMesh(ringGeo, ringMat, count);
    const colors = new Float32Array(count * 3);
    const cPurple = new THREE.Color(0xbc00ff);
    const cCyan = new THREE.Color(0x00f2ff);

    for (let i = 0; i < count; i++) {
        const mix = cPurple.clone().lerp(cCyan, Math.random());
        colors[i * 3] = mix.r; colors[i * 3 + 1] = mix.g; colors[i * 3 + 2] = mix.b;
        dummy.position.set(0, 0, i * -35);
        dummy.updateMatrix();
        instancedMesh.setMatrix(i, dummy.matrix);
    }
    ringGeo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    instancedMesh.visible = false;
    scene.add(instancedMesh);

    // 2. SETUP TEXT
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 55, height: 6, curveSegments: 12 });
        textGeo.center();
        const textMesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true }));
        textMesh.name = "introText";
        scene.add(textMesh);
    });

    // 3. LISTEN FOR UNLOCK
    window.addEventListener('click', startExperience, { once: true });
    animate();
}

async function startExperience() {
    if (isPlaying) return;
    
    // Create AudioContext inside click
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    isPlaying = true;
    document.getElementById('click-hint').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';

    const text = scene.getObjectByName("introText");
    if(text) gsap.to(text.material, { opacity: 0, duration: 1.5 });
    
    // Smooth Camera Dive
    gsap.to(camera.position, { z: 400, duration: 3, ease: "expo.inOut" });
    instancedMesh.visible = true;

    playCurrentTrack();
}

function playCurrentTrack() {
    const audio = document.getElementById(`audio-${currentTrackIndex}`);
    
    if (!analyzer) {
        const source = audioCtx.createMediaElementSource(audio);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
    }
    
    audio.play().catch(err => console.error("Audio Failed:", err));
    document.getElementById('now-playing').innerText = `SYSTEM_DROP // TRACK_0${currentTrackIndex}`;
}

window.switchTrack = function() {
    const old = document.getElementById(`audio-${currentTrackIndex}`);
    old.pause(); 
    old.currentTime = 0;
    
    currentTrackIndex = (currentTrackIndex % 3) + 1;
    playCurrentTrack();
};

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    if (instancedMesh && instancedMesh.visible) {
        instancedMesh.material.uniforms.uTime.value = time;
        let level = 0;
        
        if (analyzer) {
            const data = new Uint8Array(analyzer.frequencyBinCount);
            analyzer.getByteFrequencyData(data);
            level = (data.reduce((a, b) => a + b, 0) / data.length) / 45.0;
            instancedMesh.material.uniforms.uAudio.value = level;
            document.getElementById('progress-line').style.width = Math.min(level * 300, 100) + "%";
        }

        for (let i = 0; i < instancedMesh.count; i++) {
            // Constant forward movement (Tunnel effect)
            const z = ((i * 35 + time * 150) % 2500) - 1250;
            // Mode-specific visuals
            const s = 1 + (level * (i % 8 === 0 ? 3.0 : 0.4));
            
            dummy.position.set(
                Math.sin(time * 0.5 + i * 0.1) * 60, 
                Math.cos(time * 0.5 + i * 0.1) * 60, 
                z
            );
            dummy.rotation.z = time * 0.2 + (i * 0.04);
            dummy.scale.set(s, s, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrix(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
}

init();
