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
    // Fog adds depth and "tones down" the distant rings
    scene.fog = new THREE.FogExp2(0x000000, 0.0012);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 1500; // Start further back to keep UI clear

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-view'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // 1. THE TWISTY TUNNEL GEOMETRY
    const ringGeo = new THREE.TorusGeometry(180, 1.2, 16, 64);
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
                
                // Twisty-Turny Physics
                float angle = uTime * 0.5 + instanceMatrix[3][2] * 0.005;
                pos.x += sin(angle) * 80.0;
                pos.y += cos(angle) * 80.0;
                
                vec4 mvPosition = instanceMatrix * vec4(pos, 1.0);
                vGlow = uAudio;
                gl_Position = projectionMatrix * modelViewMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vGlow;
            void main() {
                // Toned down intensity (10.0 -> 5.0) for a mellower vibe
                vec3 finalColor = vColor * (0.8 + vGlow * 5.0);
                gl_FragColor = vec4(finalColor, 0.7);
            }
        `,
        transparent: true, blending: THREE.AdditiveBlending, vertexColors: true
    });

    const count = 500;
    instancedMesh = new THREE.InstancedMesh(ringGeo, ringMat, count);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
        // Ever-changing color gradient
        const color = new THREE.Color().setHSL((i / count) + 0.5, 0.8, 0.5);
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
        
        dummy.position.set(0, 0, i * -40);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    ringGeo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
    instancedMesh.visible = false;
    scene.add(instancedMesh);

    // 2. POSITIONED TEXT (Higher and smaller to clear the tap hint)
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        const textGeo = new TextGeometry('AI LOUNGE\nAFTER DARK', { font, size: 40, height: 4, curveSegments: 12 });
        textGeo.center();
        const textMesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true }));
        textMesh.position.y = 150; // Move it up
        textMesh.name = "introText";
        scene.add(textMesh);
        
        isReady = true;
        document.getElementById('click-hint').style.opacity = "1";
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
    if (text) gsap.to(text.material, { opacity: 0, duration: 2 });
    
    // Dive into the tunnel
    gsap.to(camera.position, { z: 400, duration: 4, ease: "power2.inOut" });
    instancedMesh.visible = true;
    playTrack(currentTrackIndex);
}

function playTrack(index) {
    const audio = document.getElementById(`audio-${index}`);
    if (!analyzer) {
        const source = audioCtx.createMediaElementSource(audio);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
    }
    audio.play();
    document.getElementById('now-playing').innerText = `TUNNEL_SYNC // 0${index}`;
}

window.switchTrack = function() {
    const old = document.getElementById(`audio-${currentTrackIndex}`);
    old.pause(); old.currentTime = 0;
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
            level = (data.reduce((a, b) => a + b, 0) / data.length) / 50.0;
            instancedMesh.material.uniforms.uAudio.value = level;
        }

        for (let i = 0; i < instancedMesh.count; i++) {
            // Forward progression logic
            const z = ((i * 40 + time * 200) % 2000) - 1000;
            
            // Subtle "Twisty" movement
            const waveX = Math.sin(time * 0.3 + i * 0.05) * 120;
            const waveY = Math.cos(time * 0.3 + i * 0.05) * 120;
            
            dummy.position.set(waveX, waveY, z);
            dummy.rotation.z = time * 0.1 + (i * 0.02);
            dummy.scale.set(1 + level, 1 + level, 1);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
}

init();
