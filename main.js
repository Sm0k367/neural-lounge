import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import gsap from 'gsap';

let scene, camera, renderer, instancedMesh, analyzer, clock, audioCtx;
let isPlaying = false;
let currentTrackIndex = 1;
let isReady = false; 
const dummy = new THREE.Object3D();

async function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1200;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 1. SETUP TUNNEL
    const ringGeo = new THREE.TorusGeometry(150, 2, 16, 40);
    const ringMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAudio: { value: 0 } },
        vertexShader: `
            varying vec3 vColor;
            varying float vGlow;
            uniform float uTime;
            uniform float uAudio;
            void main() {
                vColor = color;
                vec3 pos = position;
                float wobble = sin(uTime * 1.5 + instanceMatrix[3][2] * 0.05) * uAudio * 25.0;
                pos.x += wobble;
                vec4 mvPosition = instanceMatrix * vec4(pos, 1.0);
                vGlow = uAudio;
                gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vGlow;
            void main() {
                gl_FragColor = vec4(vColor * (1.5 + vGlow * 15.0), 0.9);
            }
        `,
        transparent: true, blending: THREE.AdditiveBlending, vertexColors: true
    });

    const count = 400;
    instancedMesh = new THREE.InstancedMesh(ringGeo, ringMat, count);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(0xbc00ff);
    const c2 = new THREE.Color(0x00f2ff);

    for (let i = 0; i < count; i++) {
        const c = c1.clone().lerp(c2, Math.random());
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        dummy.position.set(0, 0, i * -30);
        dummy.updateMatrix();
        // FIXED: Changed setMatrix to setMatrixAt
        instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    ringGeo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    instancedMesh.visible = false;
    scene.add(instancedMesh);

    // 2. LOAD FONT & ACTIVATE START
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 55, height: 5, curveSegments: 12 });
        textGeo.center();
        const textMesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true }));
        textMesh.name = "introText";
        scene.add(textMesh);
        
        isReady = true;
        const hint = document.getElementById('click-hint');
        if(hint) hint.style.opacity = "1";
    });

    window.addEventListener('pointerdown', handleStart);
    animate();
}

async function handleStart() {
    if (!isReady || isPlaying) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    isPlaying = true;
    document.getElementById('click-hint').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'flex';

    const text = scene.getObjectByName("introText");
    if (text) gsap.to(text.material, { opacity: 0, duration: 1 });
    gsap.to(camera.position, { z: 400, duration: 2.5, ease: "power4.inOut" });
    
    instancedMesh.visible = true;
    playTrack(currentTrackIndex);
}

function playTrack(index) {
    const audio = document.getElementById(`audio-${index}`);
    if (!audio) return;

    if (!analyzer) {
        const source = audioCtx.createMediaElementSource(audio);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
    }
    
    audio.play().catch(e => console.error("Audio play blocked:", e));
    document.getElementById('now-playing').innerText = `DROP_ACTIVE // 0${index}`;
}

window.switchTrack = function() {
    const old = document.getElementById(`audio-${currentTrackIndex}`);
    if(old) { old.pause(); old.currentTime = 0; }
    currentTrackIndex = (currentTrackIndex % 3) + 1;
    playTrack(currentTrackIndex);
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
            const progress = document.getElementById('progress-line');
            if(progress) progress.style.width = (level * 250) + "%";
        }

        for (let i = 0; i < instancedMesh.count; i++) {
            const z = ((i * 30 + time * 150) % 2000) - 1000;
            const s = 1 + (level * (i % 5 === 0 ? 3 : 0.2));
            dummy.position.set(Math.sin(time * 0.5 + i * 0.1) * 50, Math.cos(time * 0.5 + i * 0.1) * 50, z);
            dummy.rotation.z = time * 0.2 + (i * 0.03);
            dummy.scale.set(s, s, 1);
            dummy.updateMatrix();
            // FIXED: Changed setMatrix to setMatrixAt
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
}

init();
