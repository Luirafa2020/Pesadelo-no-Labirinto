// audio.js

let audioContext;
let masterGain;

// --- Nós de Som Ambiente ---
let ambientOscillator;
let ambientLFO;
let ambientFilter;
let ambientGain;

// --- Nós de Música de Fundo ---
let musicDroneOsc1;
let musicDroneOsc2;
let musicDroneLFOFreq1;
let musicDroneLFOFreq2;
let musicDroneFilter;
let musicDroneGain;
let musicNoiseSource;
let musicNoiseFilter;
let musicNoiseGain;
let musicDelay;
let musicFeedbackGain;
let musicDelayLFO;
let musicDelayLFOGain;

// --- Nós de Passos ---
let footstepNoiseBuffer;
let lastFootstepTime = 0;

// --- NÓS DO MONSTRO --- <<< NOVO
let monsterHeartbeatOsc;
let monsterHeartbeatGain;
let monsterHeartbeatLFOGain;
let monsterHeartbeatLFOFreq;
let monsterProximityGain; // Controla o volume geral do coração baseado na distância

// --- Constantes de Configuração ---
const FOOTSTEP_INTERVAL = 400;
const FOOTSTEP_VOLUME = 0.15;
const AMBIENT_VOLUME = 0.03;   // << Reduzido ainda mais
const MASTER_VOLUME = 0.65;    // << Levemente reduzido para acomodar novos sons

// --- Constantes da Música ---
const MUSIC_DRONE_VOL = 0.25; // << Reduzido um pouco
const MUSIC_NOISE_VOL = 0.03; // << Reduzido um pouco
const MUSIC_DELAY_FEEDBACK = 0.45;
const MUSIC_DELAY_TIME = 0.8;

// --- Constantes do Monstro --- <<< NOVO
const MONSTER_MAX_HEARTBEAT_VOL = 0.6; // Volume máximo quando perto
const MONSTER_HEARTBEAT_MIN_RATE = 0.8; // Hz (batidas por segundo) - lento
const MONSTER_HEARTBEAT_MAX_RATE = 2.5; // Hz - rápido
const MONSTER_HEARTBEAT_EFFECT_RANGE = 25.0; // Distância máxima para ouvir o coração

// --- Inicialização ---
function initAudio() {
    try {
        if (!audioContext) {
           audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!audioContext) {
            console.warn("Web Audio API não suportada.");
            return false;
        }
        if (!masterGain) {
            masterGain = audioContext.createGain();
            masterGain.gain.setValueAtTime(MASTER_VOLUME, audioContext.currentTime);
            masterGain.connect(audioContext.destination);
            console.log("Master Gain criado e conectado.");
        }
        createAmbientSoundNodes();
        createBackgroundMusicNodes();
        createFootstepBuffer();
        createMonsterSoundNodes(); // <<< NOVO
        console.log("Web Audio inicializado (ou pronto). Context state:", audioContext.state);
        return true;
    } catch (e) {
        console.error("Erro CRÍTICO ao inicializar Web Audio API:", e);
        return false;
    }
}

// --- Início/Resumo do Contexto ---
function startAudioContext() {
    if (!audioContext) { console.warn("startAudioContext: audioContext não existe."); return; }
    console.log(`startAudioContext: Tentando iniciar/resumir. Estado atual: ${audioContext.state}`);
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log(`AudioContext resumido com sucesso! Novo estado: ${audioContext.state}`);
            startContinuousSounds();
        }).catch(err => { console.error("Erro ao resumir AudioContext:", err); });
    } else if (audioContext.state === 'running') {
        console.log("AudioContext já estava rodando.");
        startContinuousSounds();
    } else { console.warn(`startAudioContext: Estado inesperado do AudioContext: ${audioContext.state}`); }
}

// --- Criação dos Nós ---
function createAmbientSoundNodes() {
    if (!audioContext || ambientOscillator) return;
    console.log("Criando nós de som ambiente...");
    ambientOscillator = audioContext.createOscillator(); ambientOscillator.type = 'sawtooth'; ambientOscillator.frequency.setValueAtTime(45, audioContext.currentTime);
    ambientLFO = audioContext.createOscillator(); ambientLFO.type = 'sine'; ambientLFO.frequency.setValueAtTime(0.12, audioContext.currentTime);
    const lfoGain = audioContext.createGain(); lfoGain.gain.setValueAtTime(0.4, audioContext.currentTime);
    ambientLFO.connect(lfoGain); lfoGain.connect(ambientOscillator.frequency);
    ambientFilter = audioContext.createBiquadFilter(); ambientFilter.type = 'lowpass'; ambientFilter.frequency.setValueAtTime(130, audioContext.currentTime); ambientFilter.Q.setValueAtTime(6, audioContext.currentTime);
    ambientGain = audioContext.createGain();
    ambientGain.gain.setValueAtTime(AMBIENT_VOLUME, audioContext.currentTime);
    ambientOscillator.connect(ambientFilter); ambientFilter.connect(ambientGain); ambientGain.connect(masterGain);
    console.log("Nós de som ambiente criados.");
}

function createBackgroundMusicNodes() {
    if (!audioContext || musicDroneOsc1) return;
    console.log(">>> Criando nós de MÚSICA de fundo...");
    try {
        // Drone
        musicDroneOsc1 = audioContext.createOscillator(); musicDroneOsc1.type = 'triangle'; musicDroneOsc1.frequency.setValueAtTime(60, audioContext.currentTime);
        musicDroneOsc2 = audioContext.createOscillator(); musicDroneOsc2.type = 'sine'; musicDroneOsc2.frequency.setValueAtTime(60.5, audioContext.currentTime); musicDroneOsc2.detune.setValueAtTime(5, audioContext.currentTime);
        musicDroneLFOFreq1 = audioContext.createOscillator(); musicDroneLFOFreq1.type = 'sine'; musicDroneLFOFreq1.frequency.setValueAtTime(0.05, audioContext.currentTime);
        const lfoGain1 = audioContext.createGain(); lfoGain1.gain.setValueAtTime(1.5, audioContext.currentTime); musicDroneLFOFreq1.connect(lfoGain1); lfoGain1.connect(musicDroneOsc1.frequency);
        musicDroneLFOFreq2 = audioContext.createOscillator(); musicDroneLFOFreq2.type = 'sine'; musicDroneLFOFreq2.frequency.setValueAtTime(0.07, audioContext.currentTime);
        const lfoGain2 = audioContext.createGain(); lfoGain2.gain.setValueAtTime(1.0, audioContext.currentTime); musicDroneLFOFreq2.connect(lfoGain2); lfoGain2.connect(musicDroneOsc2.detune);
        musicDroneFilter = audioContext.createBiquadFilter(); musicDroneFilter.type = 'lowpass'; musicDroneFilter.frequency.setValueAtTime(200, audioContext.currentTime); musicDroneFilter.Q.setValueAtTime(1.5, audioContext.currentTime);
        musicDroneGain = audioContext.createGain();
        musicDroneGain.gain.setValueAtTime(MUSIC_DRONE_VOL, audioContext.currentTime);

        // Noise
        const noiseBufferSize = audioContext.sampleRate * 2; const noiseBuffer = audioContext.createBuffer(1, noiseBufferSize, audioContext.sampleRate); const noiseOutput = noiseBuffer.getChannelData(0);
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0; for (let i = 0; i < noiseBufferSize; i++) { const white = Math.random()*2-1; b0=0.99886*b0+white*0.0555179; b1=0.99332*b1+white*0.0750759; b2=0.96900*b2+white*0.1538520; b3=0.86650*b3+white*0.3104856; b4=0.55000*b4+white*0.5329522; b5=-0.7616*b5-white*0.0168980; noiseOutput[i]=b0+b1+b2+b3+b4+b5+b6+white*0.5362; noiseOutput[i]*=0.11; b6=white*0.115926;}
        musicNoiseSource = audioContext.createBufferSource(); musicNoiseSource.buffer = noiseBuffer; musicNoiseSource.loop = true;
        musicNoiseFilter = audioContext.createBiquadFilter(); musicNoiseFilter.type = 'bandpass'; musicNoiseFilter.frequency.setValueAtTime(700, audioContext.currentTime); musicNoiseFilter.Q.setValueAtTime(0.8, audioContext.currentTime);
        musicNoiseGain = audioContext.createGain();
        musicNoiseGain.gain.setValueAtTime(MUSIC_NOISE_VOL, audioContext.currentTime);

        // Delay
        musicDelay = audioContext.createDelay(MUSIC_DELAY_TIME * 2); musicDelay.delayTime.setValueAtTime(MUSIC_DELAY_TIME, audioContext.currentTime);
        musicFeedbackGain = audioContext.createGain(); musicFeedbackGain.gain.setValueAtTime(MUSIC_DELAY_FEEDBACK, audioContext.currentTime);
        musicDelayLFO = audioContext.createOscillator(); musicDelayLFO.type = 'sine'; musicDelayLFO.frequency.setValueAtTime(0.15, audioContext.currentTime);
        musicDelayLFOGain = audioContext.createGain(); musicDelayLFOGain.gain.setValueAtTime(0.005, audioContext.currentTime); musicDelayLFO.connect(musicDelayLFOGain); musicDelayLFOGain.connect(musicDelay.delayTime);

        // Conexões
        musicDroneOsc1.connect(musicDroneFilter); musicDroneOsc2.connect(musicDroneFilter); musicDroneFilter.connect(musicDroneGain);
        musicNoiseSource.connect(musicNoiseFilter); musicNoiseFilter.connect(musicNoiseGain);
        musicDroneGain.connect(masterGain); musicNoiseGain.connect(masterGain);
        musicDroneGain.connect(musicDelay); musicNoiseGain.connect(musicDelay);
        musicDelay.connect(musicFeedbackGain); musicFeedbackGain.connect(musicDelay);
        musicDelay.connect(masterGain);
        console.log(">>> Nós de música de fundo criados e conectados.");

    } catch (error) {
        console.error(">>> ERRO ao criar ou conectar nós da música de fundo:", error);
        musicDroneOsc1 = musicDroneOsc2 = musicDroneLFOFreq1 = musicDroneLFOFreq2 = musicNoiseSource = musicDelayLFO = null;
    }
}

function createFootstepBuffer() {
    if (!audioContext || footstepNoiseBuffer) return;
    console.log("Criando buffer de passos...");
    const bufferSize = audioContext.sampleRate * 0.2; footstepNoiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate); const output = footstepNoiseBuffer.getChannelData(0); let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) { const white = Math.random()*2-1; output[i]=(lastOut+(0.02*white))/1.02; lastOut=output[i]; output[i]*=3.5;}
    console.log("Buffer de passos criado.");
}

// --- CRIAÇÃO NÓS DO MONSTRO --- <<< NOVO
function createMonsterSoundNodes() {
    if (!audioContext || monsterHeartbeatOsc) return;
    console.log("--- Criando nós de som do MONSTRO (coração)...");
    try {
        // Oscilador principal (o 'thump')
        monsterHeartbeatOsc = audioContext.createOscillator();
        monsterHeartbeatOsc.type = 'sine'; // Um 'sine' baixo funciona bem para 'thump'
        monsterHeartbeatOsc.frequency.setValueAtTime(60, audioContext.currentTime); // Frequência baixa

        // Ganho principal do batimento (para criar o pulso)
        monsterHeartbeatGain = audioContext.createGain();
        monsterHeartbeatGain.gain.setValueAtTime(0, audioContext.currentTime); // Começa silencioso

        // LFO para modular o ganho principal (cria o ritmo do batimento)
        monsterHeartbeatLFOFreq = audioContext.createOscillator();
        monsterHeartbeatLFOFreq.type = 'square'; // Square wave cria um on/off rápido
        // A frequência deste LFO será controlada pela proximidade
        monsterHeartbeatLFOFreq.frequency.setValueAtTime(MONSTER_HEARTBEAT_MIN_RATE, audioContext.currentTime);

        // Ganho do LFO (controla a intensidade da modulação de ganho)
        monsterHeartbeatLFOGain = audioContext.createGain();
        monsterHeartbeatLFOGain.gain.setValueAtTime(1.0, audioContext.currentTime); // Modulação completa

        // Ganho de Proximidade (controla o volume GERAL do efeito)
        monsterProximityGain = audioContext.createGain();
        monsterProximityGain.gain.setValueAtTime(0, audioContext.currentTime); // Começa silencioso

        // Conexões
        monsterHeartbeatOsc.connect(monsterHeartbeatGain); // Osc -> Ganho do Pulso
        monsterHeartbeatLFOFreq.connect(monsterHeartbeatLFOGain); // LFO Freq -> Ganho do LFO
        monsterHeartbeatLFOGain.connect(monsterHeartbeatGain.gain); // Saída do Ganho LFO -> Modula Ganho do Pulso
        monsterHeartbeatGain.connect(monsterProximityGain); // Saída do Pulso -> Ganho de Proximidade
        monsterProximityGain.connect(masterGain); // Saída Geral -> Master

        console.log("--- Nós do monstro (coração) criados e conectados.");
    } catch (error) {
        console.error("--- ERRO ao criar nós do monstro:", error);
        monsterHeartbeatOsc = monsterHeartbeatLFOFreq = null;
    }
}

// --- Iniciar/Parar Sons Contínuos ---
function startContinuousSounds() {
    console.log(`startContinuousSounds: Iniciando sons. Estado: ${audioContext?.state}`);
    if (!audioContext || audioContext.state !== 'running') { console.warn("startContinuousSounds: Abortando, audioContext não está rodando."); return; }

    // Ambiente
    if (ambientOscillator && ambientLFO) {
        try { ambientOscillator.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar ambientOscillator:",e);}
        try { ambientLFO.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar ambientLFO:",e); }
        console.log("-> Som ambiente iniciado (ou tentativa).");
    } else { console.warn("-> Nós do som ambiente não encontrados para iniciar."); }

    // Música
    if (musicDroneOsc1 && musicDroneOsc2 && musicDroneLFOFreq1 && musicDroneLFOFreq2 && musicNoiseSource && musicDelayLFO) {
        try { musicDroneOsc1.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar musicDroneOsc1:",e); }
        try { musicDroneOsc2.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar musicDroneOsc2:",e); }
        try { musicDroneLFOFreq1.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar musicDroneLFOFreq1:",e); }
        try { musicDroneLFOFreq2.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar musicDroneLFOFreq2:",e); }
        try { musicNoiseSource.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar musicNoiseSource:",e); }
        try { musicDelayLFO.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar musicDelayLFO:",e); }
        console.log(">>> Música de fundo iniciada (ou tentativa).");
    } else { console.warn(">>> Nós da música de fundo NÃO encontrados para iniciar."); }

    // Monstro <<< NOVO
    if (monsterHeartbeatOsc && monsterHeartbeatLFOFreq) {
         try { monsterHeartbeatOsc.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar monsterHeartbeatOsc:",e); }
         try { monsterHeartbeatLFOFreq.start(0); } catch (e) { if(e.name !== 'InvalidStateError') console.error("Erro ao iniciar monsterHeartbeatLFOFreq:",e); }
         console.log("--- Som do monstro (coração) iniciado (ou tentativa).");
    } else { console.warn("--- Nós do som do monstro NÃO encontrados para iniciar."); }
}

function stopContinuousSounds() {
    console.log("Parando sons contínuos...");
    if (!audioContext) return;
    const stopTime = audioContext.currentTime + 0.1; // Tempo para fade out

    // --- Ambiente ---
    if (ambientGain) ambientGain.gain.linearRampToValueAtTime(0.0001, stopTime); // Ramp to near zero
    if (ambientOscillator) try { ambientOscillator.stop(stopTime + 0.01); } catch(e) {} // Stop slightly after ramp
    if (ambientLFO) try { ambientLFO.stop(stopTime + 0.01); } catch(e) {}

    // --- Música ---
    if (musicDroneGain) musicDroneGain.gain.linearRampToValueAtTime(0.0001, stopTime);
    if (musicNoiseGain) musicNoiseGain.gain.linearRampToValueAtTime(0.0001, stopTime);
    if (musicFeedbackGain) musicFeedbackGain.gain.linearRampToValueAtTime(0, stopTime); // Delay feedback off
    if (musicDroneOsc1) try { musicDroneOsc1.stop(stopTime + 0.01); } catch(e) {}
    if (musicDroneOsc2) try { musicDroneOsc2.stop(stopTime + 0.01); } catch(e) {}
    if (musicDroneLFOFreq1) try { musicDroneLFOFreq1.stop(stopTime + 0.01); } catch(e) {}
    if (musicDroneLFOFreq2) try { musicDroneLFOFreq2.stop(stopTime + 0.01); } catch(e) {}
    if (musicNoiseSource) try { musicNoiseSource.stop(stopTime + 0.01); } catch(e) {}
    if (musicDelayLFO) try { musicDelayLFO.stop(stopTime + 0.01); } catch(e) {}

    // --- Monstro --- <<< NOVO
    if (monsterProximityGain) monsterProximityGain.gain.linearRampToValueAtTime(0.0001, stopTime);
    if (monsterHeartbeatOsc) try { monsterHeartbeatOsc.stop(stopTime + 0.01); } catch(e) {}
    if (monsterHeartbeatLFOFreq) try { monsterHeartbeatLFOFreq.stop(stopTime + 0.01); } catch(e) {}

    console.log("Sons contínuos parados (ou agendados para parar).");
}

// --- Tocar Sons Únicos ---
function playFootstepSound() {
    if (!audioContext || audioContext.state !== 'running' || !footstepNoiseBuffer) return; const now = performance.now(); if (now - lastFootstepTime < FOOTSTEP_INTERVAL) return; lastFootstepTime = now;
    const source = audioContext.createBufferSource(); source.buffer = footstepNoiseBuffer; const filter = audioContext.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(400 + Math.random() * 300, audioContext.currentTime); filter.Q.setValueAtTime(1.5 + Math.random() * 1.5, audioContext.currentTime); const gainNode = audioContext.createGain(); gainNode.gain.setValueAtTime(0, audioContext.currentTime); gainNode.gain.linearRampToValueAtTime(FOOTSTEP_VOLUME, audioContext.currentTime + 0.02); gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    source.connect(filter); filter.connect(gainNode); gainNode.connect(masterGain); source.start(audioContext.currentTime); source.onended = () => { try{source.disconnect(); filter.disconnect(); gainNode.disconnect();} catch(e){} }; // Added try-catch
}

// Scare Sound (Jumpscare - Tocado ao ser pego)
function playScareSound() {
    if (!audioContext || audioContext.state !== 'running') return;

    const now = audioContext.currentTime;

    // Componente 1: Ruído Branco Alto e Curto
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.4, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.8; // Ruído alto
    }
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.9, now); // Volume máximo inicial
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35); // Decaimento rápido

    // Componente 2: Tom Agudo Descendente
    const osc = audioContext.createOscillator();
    osc.type = 'sawtooth'; // Som áspero
    osc.frequency.setValueAtTime(1500, now); // Começa agudo
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.3); // Desce rapidamente

    const oscGain = audioContext.createGain();
    oscGain.gain.setValueAtTime(0.5, now); // Volume médio
    oscGain.gain.linearRampToValueAtTime(0, now + 0.4); // Fade out

    // Conexões
    noiseSource.connect(noiseGain).connect(masterGain);
    osc.connect(oscGain).connect(masterGain);

    // Start/Stop
    noiseSource.start(now);
    osc.start(now);
    noiseSource.stop(now + 0.4);
    osc.stop(now + 0.4);

    // Limpeza (opcional mas bom)
    noiseSource.onended = () => { try{noiseSource.disconnect(); noiseGain.disconnect();} catch(e){} };
    osc.onended = () => { try{osc.disconnect(); oscGain.disconnect();} catch(e){} };

    console.log("!!! BOO !!!");
}

// --- ATUALIZAÇÃO SOM DO MONSTRO --- <<< NOVO
function updateMonsterSounds(distance) {
    if (!audioContext || audioContext.state !== 'running' || !monsterProximityGain || !monsterHeartbeatLFOFreq) return;

    const now = audioContext.currentTime;
    let proximityFactor = 0; // 0 = longe, 1 = perto

    if (distance < MONSTER_HEARTBEAT_EFFECT_RANGE) {
        // Calcula o fator de proximidade (inverso da distância, mapeado para 0-1)
        proximityFactor = Math.max(0, Math.min(1, 1.0 - (distance / MONSTER_HEARTBEAT_EFFECT_RANGE)));
        // Curva não linear para intensificar mais rápido quando perto
        proximityFactor = proximityFactor * proximityFactor;
    }

    // Ajusta o volume geral do batimento
    const targetVolume = proximityFactor * MONSTER_MAX_HEARTBEAT_VOL;
    monsterProximityGain.gain.linearRampToValueAtTime(targetVolume, now + 0.2); // Suaviza a transição

    // Ajusta a frequência (velocidade) do batimento
    const targetRate = MONSTER_HEARTBEAT_MIN_RATE + proximityFactor * (MONSTER_HEARTBEAT_MAX_RATE - MONSTER_HEARTBEAT_MIN_RATE);
    monsterHeartbeatLFOFreq.frequency.linearRampToValueAtTime(targetRate, now + 0.2); // Suaviza

    // console.log(`Dist: ${distance.toFixed(1)}, ProxFactor: ${proximityFactor.toFixed(2)}, Vol: ${targetVolume.toFixed(2)}, Rate: ${targetRate.toFixed(2)}`);
}


// --- Exportações ---
window.AudioSystem = {
    initAudio,
    startAudioContext,
    playFootstepSound,
    playScareSound,
    stopContinuousSounds,
    updateMonsterSounds // <<< NOVO
};

// --- FIM DO ARQUIVO audio.js ---