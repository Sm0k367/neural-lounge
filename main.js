/**
 * NEURAL LOUNGE // AFTER DARK V1.0
 * 3D ENGINE & AUDIO SYNC
 */

let scene, camera, renderer, particles, analyzer, dataArray;
let currentTrack = 1;
let isPlaying = false;
let audioCtx;

// --- LYRIC DATA ---
const lyrics = {
    1: [
        { time: 0, text: "INITIALIZING NEURAL LINK..." },
        { time: 5, text: "WELCOME TO THE AFTER DARK LOUNGE" },
        { time: 12, text: "SINK INTO THE DATA STREAM" }
    ],
    2: [
        { time: 0, text: "THE OS OF FUNK IS LOADING..." },
        { time: 4, text: "CALIBRATING RHYTHM NODES" },
        { time: 10, text: "MANIFEST THE ALGORITHM" }
    ],
    3: [
        { time: 0, text: "WARP DRIVE ENGAGED" },
        { time: 3, text: "GO HARD OR GO HOME" },
        { time: 8, text: "PURE SOVEREIGN INTELLIGENCE" }
    ]
};

// --- CORE INITIALIZATION ---
window.initExperience = async function() {
    // Reveal UI
    document.getElementById('gatekeeper').style.display = 'none';
    document.getElementById('ui-container').style.display = 'flex';

    // Setup Audio Context (Browser requirement)
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    setupThreeJS();
    setupAudio(currentTrack);
    animate();
};

function setupThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 500;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Create Particle System
    const geo = new THREE.BufferGeometry();
    const count = 15000;
    const positions = new Float32Array(count * 3);
    
    for(let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 2000;
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ size: 2, color: 0xbc00ff, transparent: true, opacity: 0.8 });
    particles = new THREE.Points(geo, mat);
    scene.add(particles);
}

function setupAudio(trackIndex) {
    const audio = document.getElementById(`audio-${trackIndex}`);
    
    if (!analyzer) {
        const source = audioCtx.createMediaElementSource(audio);
        analyzer = audioCtx.createAnalyser();
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
        analyzer.fftSize = 256;
        dataArray = new Uint8Array(analyzer.frequencyBinCount);
    }

    audio.play();
    isPlaying = true;
}

window.nextTrack = function() {
    const currentAudio = document.getElementById(`audio-${currentTrack}`);
    currentAudio.pause();
    currentAudio.currentTime = 0;

    currentTrack = currentTrack >= 3 ? 1 : currentTrack + 1;
    
    // Update visuals based on track
    if(currentTrack === 2) particles.material.color.setHex(0x00f2ff);
    if(currentTrack === 3) particles.material.color.setHex(0xffcc00);
    
    setupAudio(currentTrack);
};

function updateLyrics(time) {
    const trackLyrics = lyrics[currentTrack];
    const activeLine = trackLyrics.reduce((prev, curr) => (time >= curr.time ? curr : prev));
    
    const lyricEl = document.getElementById('lyric-text');
    if (lyricEl.innerText !== activeLine.text) {
        lyricEl.innerText = activeLine.text;
        lyricEl.className = currentTrack === 1 ? 'neon-glow' : 'funk-style';
        gsap.fromTo(lyricEl, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1 });
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    const audio = document.getElementById(`audio-${currentTrack}`);
    
    if (analyzer && isPlaying) {
        analyzer.getByteFrequencyData(dataArray);
        let average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        // Visual behaviors
        if (currentTrack === 1) {
            particles.rotation.y += 0.001;
            particles.position.z = average * 0.5;
        } else if (currentTrack === 3) {
            // Warp Drive speed
            particles.position.z += 10 + (average * 0.2);
            if (particles.position.z > 500) particles.position.z = -500;
        }

        // Update UI
        document.getElementById('progress-fill').style.width = `${(audio.currentTime / audio.duration) * 100}%`;
        updateLyrics(audio.currentTime);
    }

    renderer.render(scene, camera);
}

// Window Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
