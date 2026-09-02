/**
 * flyby.js - Fly By: Balloon Pop & Stunt Flight
 * Complete Game Engine: Flight Aerodynamics, Balloon Collection Courses,
 * Barn Diving Mechanics, Airliners, Stunt Biplanes, Bird Flocks, Web Audio SFX & Settings.
 */

(function() {
  'use strict';

  // --- CANVAS & CONTEXT SETUP ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let gameWidth = 960;
  const GAME_HEIGHT = 540;
  const GROUND_Y = 480;
  const RUNWAY_START = 120;
  const RUNWAY_END = 480;

  // --- SAFE STORAGE WRAPPER ---
  const Storage = {
    get(key, fallback = null) {
      try { return localStorage.getItem(key) ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); }
      catch {}
    }
  };

  // --- DETECT DEVICE TYPE ---
  const isIOS = (() => {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    } catch {
      return false;
    }
  })();

  const isMobileDevice = (() => {
    try {
      return (
        window.matchMedia('(pointer: coarse)').matches ||
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '')
      );
    } catch {
      return false;
    }
  })();

  const storedInvertY = Storage.get('flyby_invert_y');
  // For mobile touch devices, default to false (non-inverted) so up/down is simpler.
  // For desktop, default to true (aviation standard: Pull Back = Climb).
  // If the user previously saved a preference, respect the saved preference.
  const initialInvertY = storedInvertY !== null ? storedInvertY === 'true' : !isMobileDevice;

  const storedPowerups = Storage.get('flyby_powerups');
  const initialPowerups = storedPowerups !== null ? storedPowerups === 'true' : true;

  // --- SETTINGS & CONFIG ---
  const settings = {
    invertY: initialInvertY,
    powerups: initialPowerups,
    touchControls: Storage.get('flyby_touch_controls') || 'auto', // 'auto', 'always', 'off'
    showInstruments: Storage.get('flyby_instruments') !== null ? Storage.get('flyby_instruments') === 'true' : true, // Cockpit side bar gauges
    scanlines: Storage.get('flyby_scanlines') !== null ? Storage.get('flyby_scanlines') === 'true' : true,       // CRT filter
    engineSound: Storage.get('flyby_engine_sound') !== null ? Storage.get('flyby_engine_sound') === 'true' : true,   // Dynamic engine pitch & volume audio
    wind: Storage.get('flyby_wind') !== null ? Storage.get('flyby_wind') === 'true' : true                 // Atmospheric wind simulation & windsock dynamics
  };

  // --- GAME STATE ---
  const state = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    highScore: parseInt(Storage.get('flyby_highscore') || Storage.get('barnstormer_highscore') || '0', 10),
    wave: 1,
    lives: 3,
    balloonsPopped: 0,
    totalBalloonsInWave: 0,
    nearMisses: 0,
    combo: 1,
    maxCombo: 1,
    lastPoppedX: null,
    lastPoppedId: null,
    cameraX: 0,
    shake: 0,
    bannerText: '',
    bannerTimer: 0
  };

  // --- LEVEL DIFFICULTY & PROGRESSION SCALING (+5% PER LEVEL) ---
  function getLevelSpeedScale(wave = state.wave) {
    return Math.pow(1.05, Math.max(0, (wave || 1) - 1));
  }

  function getLevelSpawnScale(wave = state.wave) {
    return Math.pow(1.05, Math.max(0, (wave || 1) - 1));
  }

  // --- ATMOSPHERIC WIND SIMULATION ---
  const wind = {
    speed: 0,           // Current horizontal wind speed in px/s (+ = East/Right tailwind, - = West/Left headwind)
    targetSpeed: 0,     // Target wind speed
    changeTimer: 0,     // Time until next target change
    changeInterval: 7,  // Interval between target selections (5-11 seconds)
    accel: 4.0,         // Rate of change (px/s^2) for smooth, gradual rise and fall

    reset() {
      if (!settings.wind) {
        this.speed = 0;
        this.targetSpeed = 0;
        this.changeTimer = 5;
        return;
      }
      const diffScale = getLevelSpeedScale();
      const maxWind = 168 * 0.20 * diffScale; // 20% of boosted cruise speed
      this.speed = (Math.random() * 2 - 1) * (maxWind * 0.5);
      this.targetSpeed = (Math.random() * 2 - 1) * maxWind;
      this.changeInterval = 6 + Math.random() * 5;
      this.changeTimer = this.changeInterval;
    },

    update(dt) {
      if (!settings.wind) {
        this.speed = 0;
        this.targetSpeed = 0;
        return;
      }

      const diffScale = getLevelSpeedScale();
      this.changeTimer -= dt;
      if (this.changeTimer <= 0) {
        this.changeInterval = 5 + Math.random() * 6; // 5 to 11 seconds
        this.changeTimer = this.changeInterval;
        const maxWind = 168 * 0.20 * diffScale;
        this.targetSpeed = (Math.random() * 2 - 1) * maxWind;
      }

      // Smooth gradual rise/fall towards target speed
      const diff = this.targetSpeed - this.speed;
      const step = (this.accel * diffScale) * dt;
      if (Math.abs(diff) <= step) {
        this.speed = this.targetSpeed;
      } else {
        this.speed += Math.sign(diff) * step;
      }
    }
  };

  // --- ATMOSPHERIC WIND GUSTS (Swirling Country Leaves) ---
  const windLeaves = [];
  let leafGustTimer = 2.0; // Countdown until next gust of leaves
  const LEAF_COLORS = ['#e76f51', '#f4a261', '#e9c46a', '#70a040', '#9c6644', '#d4a373'];

  function triggerLeafGust() {
    if (!settings.wind) return;
    const currentWind = wind.speed;
    const windMag = Math.abs(currentWind);
    if (windMag < 2.5) return; // Calm / negligible breeze

    const diffScale = getLevelSpeedScale();
    const maxWind = Math.max(25, 33.6 * diffScale);
    const windRatio = Math.min(1.0, windMag / maxWind);

    // Direction wind is blowing toward (+1 = East/Right, -1 = West/Left)
    const dir = currentWind >= 0 ? 1 : -1;

    // Cluster count: 4 to 9 leaves in a natural gust formation
    const leafCount = Math.round(4 + windRatio * 5);

    // Spawn origin just offscreen on the windward side
    const originX = dir > 0 ? (state.cameraX - 25) : (state.cameraX + gameWidth + 25);
    const originY = 50 + Math.random() * (GROUND_Y - 170);

    for (let i = 0; i < leafCount; i++) {
      const staggerX = (Math.random() - 0.5) * 60 - dir * (i * 12);
      const staggerY = (Math.random() - 0.5) * 45;
      const speedScale = 1.05 + Math.random() * 0.45;

      windLeaves.push({
        x: originX + staggerX,
        y: originY + staggerY,
        vx: currentWind * speedScale + dir * (10 + Math.random() * 15),
        vy: 8 + Math.random() * 14,
        length: 3.5 + Math.random() * 1.8,
        width: 2.0 + Math.random() * 1.0,
        color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * (4 + windRatio * 6),
        flutter: Math.random() * Math.PI * 2,
        flutterSpeed: 3.5 + Math.random() * 4.0,
        flutterAmp: 14 + Math.random() * 10,
        life: 1.0,
        onGround: false
      });
    }
  }

  function resetWindLeaves() {
    windLeaves.length = 0;
    leafGustTimer = 2.0 + Math.random() * 2.0;
  }

  function updateWindLeaves(dt) {
    if (!settings.wind) {
      windLeaves.length = 0;
      return;
    }

    const currentWind = wind.speed;
    const windMag = Math.abs(currentWind);
    const maxWind = Math.max(25, 33.6 * getLevelSpeedScale());
    const windRatio = Math.min(1.0, windMag / maxWind);

    // Gust frequency scales with wind: high wind = frequent gusts (every 2.5-4.5s), low wind = rare (8-12s)
    leafGustTimer -= dt;
    if (leafGustTimer <= 0) {
      if (windMag >= 3.0) {
        triggerLeafGust();
        leafGustTimer = 2.2 + (1.0 - windRatio) * 4.8 + Math.random() * 2.0;
      } else {
        leafGustTimer = 7.0 + Math.random() * 5.0;
      }
    }

    // Update active leaves with O(1) swap-and-pop
    for (let i = windLeaves.length - 1; i >= 0; i--) {
      const leaf = windLeaves[i];

      if (leaf.onGround) {
        leaf.vx *= 0.85;
        leaf.x += leaf.vx * dt;
        leaf.life -= dt * 1.5;
      } else {
        leaf.flutter += leaf.flutterSpeed * dt;
        leaf.rotation += leaf.rotSpeed * dt;
        leaf.x += (leaf.vx + Math.sin(leaf.flutter) * leaf.flutterAmp) * dt;
        leaf.y += (leaf.vy + Math.cos(leaf.flutter) * 6) * dt;

        // Ground contact
        if (leaf.y >= GROUND_Y - 3) {
          leaf.y = GROUND_Y - 3;
          leaf.onGround = true;
          leaf.rotSpeed = 0;
        }

        // Fade if far off camera
        const rx = leaf.x - state.cameraX;
        if (rx < -120 || rx > gameWidth + 120) {
          leaf.life -= dt * 2.5;
        }
      }

      if (leaf.life <= 0) {
        windLeaves[i] = windLeaves[windLeaves.length - 1];
        windLeaves.pop();
      }
    }
  }

  function drawWindLeaves(ctx, camX) {
    if (!settings.wind || windLeaves.length === 0) return;

    for (let i = 0; i < windLeaves.length; i++) {
      const leaf = windLeaves[i];
      const rx = leaf.x - camX;
      if (rx < -25 || rx > gameWidth + 25) continue;

      ctx.save();
      ctx.translate(Math.round(rx), Math.round(leaf.y));
      ctx.rotate(leaf.rotation + Math.sin(leaf.flutter) * 0.35);
      ctx.globalAlpha = Math.max(0, Math.min(1.0, leaf.life));
      ctx.fillStyle = leaf.color;

      // Clean retro pointed leaf shape
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.length, leaf.width, 0, 0, Math.PI * 2);
      ctx.fill();

      // Delicate leaf stem / vein detail
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-leaf.length, 0);
      ctx.lineTo(leaf.length * 0.6, 0);
      ctx.stroke();

      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }

  // --- RETRO SOUND SYNTHESIZER (Web Audio API) ---
  let audioCtx = null;
  let masterAudioGain = null;
  let engineAudio = null;
  let airlinerAudioVoices = [];
  let sharedPinkNoiseBuffer = null;
  let sharedWhiteNoiseBuffer = null;

  // Shared noise buffer generators for wind, jet exhaust roar, crashes and whooshes
  function createPinkNoiseBuffer(ctx, duration = 2) {
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return noiseBuffer;
  }

  function createWhiteNoiseBuffer(ctx, duration = 1.5) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && !masterAudioGain) {
      masterAudioGain = audioCtx.createGain();
      masterAudioGain.gain.setValueAtTime(settings.engineSound ? 1.0 : 0.0, audioCtx.currentTime);
      masterAudioGain.connect(audioCtx.destination);
    }
    if (audioCtx && !sharedPinkNoiseBuffer) {
      sharedPinkNoiseBuffer = createPinkNoiseBuffer(audioCtx, 2.0);
    }
    if (audioCtx && !sharedWhiteNoiseBuffer) {
      sharedWhiteNoiseBuffer = createWhiteNoiseBuffer(audioCtx, 1.5);
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (audioCtx && !engineAudio) {
      setupEngineAudio();
    }
    if (audioCtx && (!airlinerAudioVoices || airlinerAudioVoices.length === 0)) {
      setupAirlinerAudio();
    }
  }

  function setupEngineAudio() {
    if (!audioCtx || engineAudio || !masterAudioGain) return;
    try {
      // 1. Master Engine Gain Node connected to masterAudioGain
      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      masterGain.connect(masterAudioGain);

      // 2. Primary Cylinder / Propeller Oscillator (Sawtooth)
      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(38, audioCtx.currentTime);

      const osc1Gain = audioCtx.createGain();
      osc1Gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      osc1.connect(osc1Gain);

      // 3. Sub-harmonic / Piston Rumble Oscillator (Triangle with slight detune)
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(19, audioCtx.currentTime);
      osc2.detune.setValueAtTime(4, audioCtx.currentTime);

      const osc2Gain = audioCtx.createGain();
      osc2Gain.gain.setValueAtTime(0.24, audioCtx.currentTime);
      osc2.connect(osc2Gain);

      // 4. Low-pass filter for throaty vintage engine timbre
      const engineFilter = audioCtx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.setValueAtTime(260, audioCtx.currentTime);
      engineFilter.Q.setValueAtTime(2.2, audioCtx.currentTime);

      osc1Gain.connect(engineFilter);
      osc2Gain.connect(engineFilter);
      engineFilter.connect(masterGain);

      // 5. Propeller & Airspeed Wind Hiss (Pink/White noise loop)
      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = sharedPinkNoiseBuffer || createPinkNoiseBuffer(audioCtx, 2);
      noiseSource.loop = true;

      const windFilter = audioCtx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(320, audioCtx.currentTime);
      windFilter.Q.setValueAtTime(1.2, audioCtx.currentTime);

      const windGain = audioCtx.createGain();
      windGain.gain.setValueAtTime(0, audioCtx.currentTime);

      noiseSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);

      // Start looping sound generators
      const now = audioCtx.currentTime;
      osc1.start(now);
      osc2.start(now);
      noiseSource.start(now);

      engineAudio = {
        masterGain,
        osc1,
        osc2,
        engineFilter,
        windFilter,
        windGain
      };
    } catch (err) {
      console.warn('Could not initialize engine audio:', err);
    }
  }

  function setupAirlinerAudio() {
    if (!audioCtx || (airlinerAudioVoices && airlinerAudioVoices.length > 0) || !masterAudioGain) return;
    try {
      airlinerAudioVoices = [];
      const sharedNoise = sharedPinkNoiseBuffer || createPinkNoiseBuffer(audioCtx, 2);
      const MAX_VOICES = 3;

      for (let v = 0; v < MAX_VOICES; v++) {
        // Master Gain Node for this airliner voice
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0, audioCtx.currentTime);

        let panner = null;
        if (audioCtx.createStereoPanner) {
          panner = audioCtx.createStereoPanner();
          panner.pan.setValueAtTime(0, audioCtx.currentTime);
          panner.connect(masterGain);
        }

        const voiceDest = panner || masterGain;
        masterGain.connect(masterAudioGain);

        // Distance Atmospheric Damping Filter (Lowpass)
        const distanceFilter = audioCtx.createBiquadFilter();
        distanceFilter.type = 'lowpass';
        distanceFilter.frequency.setValueAtTime(2400, audioCtx.currentTime);
        distanceFilter.Q.setValueAtTime(0.8, audioCtx.currentTime);
        distanceFilter.connect(voiceDest);

        // 1. Primary Square Wave Jet Turbine (Retro buzz, constant base pitch: 175 Hz)
        const oscSquare1 = audioCtx.createOscillator();
        oscSquare1.type = 'square';
        oscSquare1.frequency.setValueAtTime(175, audioCtx.currentTime);

        const square1Filter = audioCtx.createBiquadFilter();
        square1Filter.type = 'bandpass';
        square1Filter.frequency.setValueAtTime(550, audioCtx.currentTime);
        square1Filter.Q.setValueAtTime(1.8, audioCtx.currentTime);

        const square1Gain = audioCtx.createGain();
        square1Gain.gain.setValueAtTime(0.12, audioCtx.currentTime);

        oscSquare1.connect(square1Filter);
        square1Filter.connect(square1Gain);
        square1Gain.connect(distanceFilter);

        // 2. Secondary Detuned Square Wave (Upper turbine harmonic buzz: 350 Hz)
        const oscSquare2 = audioCtx.createOscillator();
        oscSquare2.type = 'square';
        oscSquare2.frequency.setValueAtTime(350, audioCtx.currentTime);
        oscSquare2.detune.setValueAtTime(9, audioCtx.currentTime);

        const square2Filter = audioCtx.createBiquadFilter();
        square2Filter.type = 'bandpass';
        square2Filter.frequency.setValueAtTime(1100, audioCtx.currentTime);
        square2Filter.Q.setValueAtTime(2.0, audioCtx.currentTime);

        const square2Gain = audioCtx.createGain();
        square2Gain.gain.setValueAtTime(0.06, audioCtx.currentTime);

        oscSquare2.connect(square2Filter);
        square2Filter.connect(square2Gain);
        square2Gain.connect(distanceFilter);

        // 3. High-Frequency Airflow Hiss (Crisp rushing jet noise)
        const hissSource = audioCtx.createBufferSource();
        hissSource.buffer = sharedNoise;
        hissSource.loop = true;

        const hissFilter = audioCtx.createBiquadFilter();
        hissFilter.type = 'bandpass';
        hissFilter.frequency.setValueAtTime(1600, audioCtx.currentTime);
        hissFilter.Q.setValueAtTime(1.1, audioCtx.currentTime);

        const hissGain = audioCtx.createGain();
        hissGain.gain.setValueAtTime(0.38, audioCtx.currentTime);

        hissSource.connect(hissFilter);
        hissFilter.connect(hissGain);
        hissGain.connect(distanceFilter);

        // 4. Broad Jet Exhaust Roar / Rush (Lower noise body)
        const roarSource = audioCtx.createBufferSource();
        roarSource.buffer = sharedNoise;
        roarSource.loop = true;

        const roarFilter = audioCtx.createBiquadFilter();
        roarFilter.type = 'bandpass';
        roarFilter.frequency.setValueAtTime(520, audioCtx.currentTime);
        roarFilter.Q.setValueAtTime(1.3, audioCtx.currentTime);

        const roarGain = audioCtx.createGain();
        roarGain.gain.setValueAtTime(0.24, audioCtx.currentTime);

        roarSource.connect(roarFilter);
        roarFilter.connect(roarGain);
        roarGain.connect(distanceFilter);

        // Start continuous generators
        const now = audioCtx.currentTime;
        oscSquare1.start(now);
        oscSquare2.start(now);
        hissSource.start(now);
        roarSource.start(now);

        airlinerAudioVoices.push({
          masterGain,
          panner,
          distanceFilter,
          oscSquare1,
          square1Filter,
          oscSquare2,
          square2Filter,
          hissFilter,
          roarFilter
        });
      }
    } catch (err) {
      console.warn('Could not initialize airliner audio:', err);
    }
  }

  function updateEngineSound(plane, dt) {
    if (!audioCtx || !engineAudio) return;

    const now = audioCtx.currentTime;

    // Determine if engine sound should be silenced
    const shouldMute = !state.running || state.paused || state.gameOver || !plane || plane.isDead || !settings.engineSound;

    if (shouldMute) {
      engineAudio.masterGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    const cruiseSpeed = plane.cruiseSpeed || 168;
    const maxDive = plane.maxDiveSpeed || 396;
    const cruiseRatio = cruiseSpeed / maxDive; // ~0.424
    const maxLevelPitch = 34 + cruiseRatio * 180; // ~110.4 Hz (max level flight pitch)
    const maxLevelFilter = 200 + cruiseRatio * 1250; // ~730 Hz
    const maxLevelVol = 0.08 + cruiseRatio * 0.24; // ~0.182

    // 1. Ground Idle / Parked State (Low steady rumble at rest)
    if (plane.onGround && (plane.isStopped || plane.isParkedForService) && !plane.throttleUp) {
      const targetPitch = 34; // Idle rumble (34 Hz)
      const targetFilterFreq = 200;
      const targetVolume = 0.06;

      engineAudio.osc1.frequency.setTargetAtTime(targetPitch, now, 0.08);
      engineAudio.osc2.frequency.setTargetAtTime(targetPitch * 0.5, now, 0.08);
      engineAudio.engineFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.08);
      engineAudio.masterGain.gain.setTargetAtTime(targetVolume, now, 0.08);
      engineAudio.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // 2. Ground Takeoff Spool State (Spool up rapidly to max level flight sound/RPM)
    if (plane.onGround && plane.throttleUp) {
      const rpm = plane.rpm || 0.2;
      const targetPitch = 34 + rpm * (maxLevelPitch - 34);
      const targetFilterFreq = 200 + rpm * (maxLevelFilter - 200);
      const targetVolume = 0.06 + rpm * (maxLevelVol - 0.06);
      const targetWindVol = rpm * 0.04;
      const targetWindFreq = 250 + rpm * 500;

      engineAudio.osc1.frequency.setTargetAtTime(targetPitch, now, 0.06);
      engineAudio.osc2.frequency.setTargetAtTime(targetPitch * 0.5, now, 0.06);
      engineAudio.engineFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.06);
      engineAudio.masterGain.gain.setTargetAtTime(targetVolume, now, 0.06);
      engineAudio.windGain.gain.setTargetAtTime(targetWindVol, now, 0.06);
      engineAudio.windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.06);
      return;
    }

    // 3. Airborne Throttle: Idle State Audio (Gliding)
    if (!plane.onGround && plane.isIdle) {
      const speed = Math.max(0, plane.airspeed);
      const speedRatio = Math.min(1.0, speed / 330);
      let targetPitch = Math.max(22, 34 + speedRatio * 35);
      if (plane.stalled) targetPitch = Math.max(20, targetPitch * 0.7);

      engineAudio.osc1.frequency.setTargetAtTime(targetPitch, now, 0.08);
      engineAudio.osc2.frequency.setTargetAtTime(targetPitch * 0.5, now, 0.08);
      engineAudio.engineFilter.frequency.setTargetAtTime(200 + speedRatio * 250, now, 0.08);
      engineAudio.masterGain.gain.setTargetAtTime(0.06 + speedRatio * 0.06, now, 0.08);

      const targetWindVol = Math.pow(speedRatio, 2.0) * 0.20;
      const targetWindFreq = 250 + speedRatio * 1400;
      engineAudio.windGain.gain.setTargetAtTime(targetWindVol, now, 0.08);
      engineAudio.windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.08);
      return;
    }

    // 4. Airborne Max Throttle Flight
    // Dynamic pitch and volume calculations based on airspeed, with gradual settle from takeoff
    const speed = Math.max(0, plane.airspeed);
    const speedRatio = Math.min(1.0, speed / maxDive);

    const flightPitch = 34 + speedRatio * 180;
    const flightFilterFreq = 200 + speedRatio * 1250;
    const flightVolume = 0.08 + speedRatio * 0.24;

    // Smooth blend settling back from takeoff spool to standard flight acoustics
    const takeoffBlend = plane.takeoffTimer ? Math.min(1.0, Math.max(0, plane.takeoffTimer)) : 0;
    let targetPitch = flightPitch + takeoffBlend * (maxLevelPitch - flightPitch);
    let targetFilterFreq = flightFilterFreq + takeoffBlend * (maxLevelFilter - flightFilterFreq);
    let targetVolume = flightVolume + takeoffBlend * (maxLevelVol - flightVolume);

    if (plane.stalled) {
      targetPitch = Math.max(26, targetPitch * 0.70); // Engine sputters down during stall
      targetFilterFreq = Math.max(160, targetFilterFreq * 0.65);
      targetVolume *= 0.65;
    }
    if (plane.fuel <= 0 || plane.engineFailed || plane.isWobblingCrash) {
      targetPitch = Math.max(16, targetPitch * 0.35); // Unpowered windmilling prop / dead engine
      targetFilterFreq = 160;
      targetVolume = 0.03;
    }

    // Wind / Prop Wash Hiss: Rises dynamically during flight & dives
    let targetWindVol = Math.pow(speedRatio, 2.0) * 0.24;
    if (plane.stalled) targetWindVol += 0.08;
    const targetWindFreq = 250 + speedRatio * 1500;

    engineAudio.osc1.frequency.setTargetAtTime(targetPitch, now, 0.07);
    engineAudio.osc2.frequency.setTargetAtTime(targetPitch * 0.5, now, 0.07);
    engineAudio.engineFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.07);
    engineAudio.masterGain.gain.setTargetAtTime(Math.min(0.38, targetVolume), now, 0.07);
    engineAudio.windGain.gain.setTargetAtTime(targetWindVol, now, 0.07);
    engineAudio.windFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.07);
  }

  function updateAirlinersSound(plane, dt) {
    if (!audioCtx || !airlinerAudioVoices || airlinerAudioVoices.length === 0) return;

    const now = audioCtx.currentTime;
    const shouldMute = !state.running || state.paused || state.gameOver || !plane || !settings.engineSound;

    if (shouldMute || !airliners || airliners.length === 0) {
      for (let i = 0; i < airlinerAudioVoices.length; i++) {
        airlinerAudioVoices[i].masterGain.gain.setTargetAtTime(0, now, 0.05);
      }
      return;
    }

    const MAX_AUDIBLE_DIST = 1200;
    const activeList = airliners
      .filter(al => !al.isDead)
      .map(al => {
        const dx = al.x - plane.x;
        const dy = al.y - plane.y;
        const dist = Math.hypot(dx, dy);
        return { al, dx, dy, dist };
      })
      .sort((a, b) => a.dist - b.dist);

    for (let i = 0; i < airlinerAudioVoices.length; i++) {
      const voice = airlinerAudioVoices[i];
      if (i >= activeList.length) {
        voice.masterGain.gain.setTargetAtTime(0, now, 0.06);
        continue;
      }

      const { al, dx, dy, dist } = activeList[i];

      // Far away jets are silent
      if (dist >= MAX_AUDIBLE_DIST) {
        voice.masterGain.gain.setTargetAtTime(0, now, 0.06);
        continue;
      }

      // Distance attenuation: smooth quadratic falloff
      const distRatio = Math.max(0, 1 - dist / MAX_AUDIBLE_DIST);
      let targetVolume = 0.28 * distRatio * distRatio;
      if (al.isCrashing) {
        targetVolume *= 0.5;
      }

      // Doppler effect relative to our plane:
      // Delta of horizontal velocities projected along line between planes
      const nx = dist > 0 ? (dx / dist) : 0;
      const deltaVx = plane.vx - al.vx;
      const vRel = nx * deltaVx;

      // Speed of sound in pixel/sec coordinate space
      const cSound = 750;
      // Doppler frequency shift factor: c / (c - vRel)
      let dopplerFactor = cSound / Math.max(120, cSound - vRel);
      dopplerFactor = Math.max(0.5, Math.min(2.0, dopplerFactor));

      // Constant intrinsic jet frequencies shifted by Doppler effect
      const baseSquare1 = 175;
      const baseSquare1Filter = 550;
      const baseSquare2 = 350;
      const baseSquare2Filter = 1100;
      const baseHissFilter = 1600;
      const baseRoarFilter = 520;

      const targetPitch1 = baseSquare1 * dopplerFactor;
      const targetFilter1 = Math.max(150, Math.min(3500, baseSquare1Filter * dopplerFactor));
      const targetPitch2 = baseSquare2 * dopplerFactor;
      const targetFilter2 = Math.max(250, Math.min(5000, baseSquare2Filter * dopplerFactor));
      const targetHissFilter = Math.max(400, Math.min(6000, baseHissFilter * dopplerFactor));
      const targetRoarFilter = Math.max(150, Math.min(3000, baseRoarFilter * dopplerFactor));

      // Atmospheric high-frequency absorption over distance modulated by Doppler shift
      const targetAtmosphereCutoff = Math.max(250, (450 + distRatio * 2600) * dopplerFactor);

      voice.oscSquare1.frequency.setTargetAtTime(targetPitch1, now, 0.05);
      voice.square1Filter.frequency.setTargetAtTime(targetFilter1, now, 0.05);
      voice.oscSquare2.frequency.setTargetAtTime(targetPitch2, now, 0.05);
      voice.square2Filter.frequency.setTargetAtTime(targetFilter2, now, 0.05);
      voice.hissFilter.frequency.setTargetAtTime(targetHissFilter, now, 0.05);
      voice.roarFilter.frequency.setTargetAtTime(targetRoarFilter, now, 0.05);
      voice.distanceFilter.frequency.setTargetAtTime(targetAtmosphereCutoff, now, 0.05);
      voice.masterGain.gain.setTargetAtTime(targetVolume, now, 0.05);

      if (voice.panner) {
        const pan = Math.max(-1, Math.min(1, dx / 480));
        voice.panner.pan.setTargetAtTime(pan, now, 0.05);
      }
    }
  }

  function playSound(type, param = 1) {
    if (!audioCtx || !settings.engineSound || !masterAudioGain) return;
    try {
      const now = audioCtx.currentTime;
      const destination = masterAudioGain;

      if (type === 'pop') {
        // High-pitched bright rubber pop
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const pitch = 450 + Math.min(param * 70, 700); // Higher pitch on combo
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, now);
        osc.frequency.exponentialRampToValueAtTime(pitch * 2.2, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (type === 'gold_pop') {
        // Chime for gold balloon
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.08);
        osc.frequency.setValueAtTime(1760, now + 0.16);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'crash') {
        // Low rumble crash using preallocated noise buffer
        const noise = audioCtx.createBufferSource();
        noise.buffer = sharedWhiteNoiseBuffer || createWhiteNoiseBuffer(audioCtx, 0.4);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.4);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        noise.start(now);
        noise.stop(now + 0.42);
      } else if (type === 'fire_ignite') {
        // Sudden whooshing flame eruption burst
        const noise = audioCtx.createBufferSource();
        noise.buffer = sharedWhiteNoiseBuffer || createWhiteNoiseBuffer(audioCtx, 0.6);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.linearRampToValueAtTime(750, now + 0.1);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.55);
        filter.Q.setValueAtTime(1.8, now);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        noise.start(now);
        noise.stop(now + 0.56);
      } else if (type === 'boost') {
        // Whoosh boost sound
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(280, now + 0.2);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.26);
      } else if (type === 'stage_clear') {
        // Fanfare
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.25, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.32);
        });
      } else if (type === 'bird_strike') {
        // Feather flutter + thud
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.18);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'engine_sputter') {
        // Coughing misfire pulses
        for (let i = 0; i < 3; i++) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(85 - i * 15, now + i * 0.07);
          gain.gain.setValueAtTime(0.25, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.06);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.07);
        }
      } else if (type === 'wing_tear') {
        // Harsh metal/wooden stress snap using preallocated noise buffer
        const noise = audioCtx.createBufferSource();
        noise.buffer = sharedWhiteNoiseBuffer || createWhiteNoiseBuffer(audioCtx, 0.3);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(260, now + 0.25);
        filter.Q.setValueAtTime(3.2, now);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        noise.start(now);
        noise.stop(now + 0.27);
      } else if (type === 'big_crash') {
        // Heavy catastrophic explosion rumble using preallocated noise buffer
        const noise = audioCtx.createBufferSource();
        noise.buffer = sharedWhiteNoiseBuffer || createWhiteNoiseBuffer(audioCtx, 1.0);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, now);
        filter.frequency.exponentialRampToValueAtTime(25, now + 0.8);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        noise.start(now);
        noise.stop(now + 0.85);
      } else if (type === 'near_miss') {
        // High-speed Doppler whoosh + chime
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // Doppler pitch slide down from 980 Hz to 420 Hz
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(980, now);
        osc1.frequency.exponentialRampToValueAtTime(360, now + 0.28);

        // High harmony chime
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1480, now);
        osc2.frequency.exponentialRampToValueAtTime(880, now + 0.22);

        // Whoosh noise sweep using preallocated noise buffer
        const noise = audioCtx.createBufferSource();
        noise.buffer = sharedWhiteNoiseBuffer || createWhiteNoiseBuffer(audioCtx, 0.3);

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1800, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.25);
        noiseFilter.Q.setValueAtTime(2.5, now);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(destination);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(destination);

        osc1.start(now);
        osc2.start(now);
        noise.start(now);
        osc1.stop(now + 0.29);
        osc2.stop(now + 0.29);
        noise.stop(now + 0.30);
      } else if (type === 'powerup_speed') {
        // High-energy ascending arpeggio chime
        const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        freqs.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.28, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.25);
          osc.connect(gain);
          gain.connect(destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.26);
        });
      } else if (type === 'powerup_gun') {
        // Heavy metallic cocking click + power surge chord
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        const gain2 = audioCtx.createGain();

        // Mechanical click
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(320, now);
        osc1.frequency.setValueAtTime(640, now + 0.06);
        osc1.frequency.setValueAtTime(180, now + 0.12);
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc1.connect(gain1);
        gain1.connect(destination);
        osc1.start(now);
        osc1.stop(now + 0.23);

        // Power-up surge
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(220, now + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(880, now + 0.35);
        gain2.gain.setValueAtTime(0.25, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc2.connect(gain2);
        gain2.connect(destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.42);
      } else if (type === 'machine_gun') {
        // Crisp punchy vintage biplane Vickers/Spandau machine gun burst
        const noise = audioCtx.createBufferSource();
        noise.buffer = sharedWhiteNoiseBuffer || createWhiteNoiseBuffer(audioCtx, 0.1);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.06);
        filter.Q.setValueAtTime(2.0, now);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        // Square wave tone punch for mechanical barrel clack
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);
        oscGain.gain.setValueAtTime(0.35, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        osc.connect(oscGain);
        oscGain.connect(destination);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.07);
        osc.stop(now + 0.07);
      } else if (type === 'bullet_ricochet') {
        // Metallic ricochet ping
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200, now);
        osc.frequency.exponentialRampToValueAtTime(650, now + 0.12);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.13);
      }
    } catch (e) {
      // Audio not permitted yet or failed
    }
  }

  // --- INPUT CONTROLLER ---
  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false,
    boost: false,
    fire: false
  };

  const touchState = {
    btnUp: false,
    btnDown: false,
    throttle: false,
    btnFire: false
  };

  function updatePauseBtnIcon() {
    if (domCache.pauseBtn) {
      domCache.pauseBtn.textContent = state.paused ? '▶' : '⏸';
    }
  }

  function isFireKey(e) {
    const k = (e.key || '').toLowerCase();
    return e.code === 'KeyX' || e.code === 'KeyZ' || e.code === 'KeyJ' ||
           e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft' || e.code === 'ControlRight' ||
           k === 'x' || k === 'z' || k === 'j';
  }

  window.addEventListener('keydown', (e) => {
    initAudio();
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space') { keys.space = true; keys.boost = true; e.preventDefault(); }
    if (isFireKey(e)) {
      keys.fire = true;
    }
    if (e.code === 'KeyP') {
      if (state.running && !state.gameOver) {
        state.paused = !state.paused;
        updatePauseBtnIcon();
      }
    }
    if (e.code === 'Escape') {
      toggleSettings();
    }
    if (e.code === 'KeyM') {
      toggleMute();
    }
    if (e.code === 'KeyF') {
      toggleFullscreen();
    }
    const settingsClosed = !domCache.settingsModal || domCache.settingsModal.classList.contains('hidden');
    if ((e.code === 'Space' || e.code === 'Enter') && settingsClosed) {
      if (!state.running && !state.gameOver) {
        e.preventDefault();
        restartGame();
      } else if (state.gameOver && (e.code === 'Enter' || !e.repeat)) {
        e.preventDefault();
        restartGame();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space') { keys.space = false; keys.boost = false; }
    if (isFireKey(e)) {
      keys.fire = false;
    }
  });

  window.addEventListener('pointerdown', () => {
    initAudio();
  });

  function bindTouchButton(btn, onDown, onUp) {
    if (!btn) return;
    const handleDown = (e) => {
      e.preventDefault();
      initAudio();
      btn.classList.add('active');
      try {
        if (e.pointerId !== undefined && btn.setPointerCapture) {
          btn.setPointerCapture(e.pointerId);
        }
      } catch (_) {}
      onDown();
    };

    const handleUp = (e) => {
      e.preventDefault();
      btn.classList.remove('active');
      try {
        if (e.pointerId !== undefined && btn.releasePointerCapture) {
          btn.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
      onUp();
    };

    btn.addEventListener('pointerdown', handleDown);
    btn.addEventListener('pointerup', handleUp);
    btn.addEventListener('pointercancel', handleUp);
    btn.addEventListener('pointerleave', handleUp);
  }

  // --- FLOATING TEXT & POPUPS ---
  const floatingTexts = [];

  function addFloatingText(x, y, text, color = '#ffdf40', size = 10) {
    floatingTexts.push({
      x,
      y,
      text,
      color,
      size,
      life: 1.0,
      vy: -45
    });
  }

  // --- PARTICLE SYSTEM ---
  const particles = [];

  function createConfettiBurst(x, y, count = 20, special = false) {
    const colors = special 
      ? ['#ffd700', '#fff380', '#ffffff', '#ff9900', '#ff4500']
      : ['#ff3366', '#33ccff', '#ffcc00', '#33ff77', '#ff66cc', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 160 + 40;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        life: 1.0,
        decay: Math.random() * 1.2 + 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 90,
        isConfetti: true,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12
      });
    }
  }

  function createExplosion(x, y, count = 30) {
    state.shake = Math.min(state.shake + count * 0.3, 14);
    playSound('crash');

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 150 + 30;
      const r = Math.random();
      const color = r < 0.35 ? '#ff3311' : r < 0.7 ? '#ff9900' : '#ffe14c';

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        life: 1.0,
        decay: Math.random() * 1.2 + 0.8,
        color,
        gravity: 60
      });
    }
  }

  function createSmokePuff(x, y, vx = 0, vy = 0, size = 3, color = 'rgba(230,230,230,') {
    const validSize = Math.max(0.5, size);
    particles.push({
      x,
      y,
      vx: vx * 0.2 + (Math.random() - 0.5) * 10,
      vy: vy * 0.2 - Math.random() * 15 - 5,
      size: validSize,
      life: 1.0,
      decay: Math.random() * 1.4 + 0.9,
      color,
      isSmoke: true,
      gravity: -8
    });
  }

  function createFirePuff(x, y, vx = 0, vy = 0, size = 4) {
    const validSize = Math.max(0.5, size);
    particles.push({
      x,
      y,
      vx: vx * 0.2 + (Math.random() - 0.5) * 20,
      vy: vy * 0.2 - Math.random() * 25 - 5,
      size: validSize,
      life: 1.0,
      decay: Math.random() * 1.8 + 1.2,
      color: Math.random() < 0.5 ? '#ff4500' : '#ffaa00',
      isFire: true,
      gravity: -10
    });
  }

  function createDebrisPiece(options) {
    particles.push({
      x: options.x,
      y: options.y,
      vx: options.vx,
      vy: options.vy,
      gravity: options.gravity !== undefined ? options.gravity : 150,
      rotation: options.rotation || (Math.random() * Math.PI * 2),
      rotSpeed: options.rotSpeed !== undefined ? options.rotSpeed : (Math.random() - 0.5) * 12,
      width: options.width || 8,
      height: options.height || 4,
      color: options.color || '#ffcc00',
      accentColor: options.accentColor || null,
      type: options.type || 'generic',
      isDebris: true,
      smoking: options.smoking || false,
      smokeTimer: 0,
      life: options.life || 3.5,
      decay: options.decay || 0.8,
      bounce: options.bounce !== undefined ? options.bounce : 0.45
    });
  }

  function createFeatherBurst(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 70 + 15;
      particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        flutter: Math.random() * Math.PI * 2,
        flutterSpeed: Math.random() * 5 + 4,
        size: Math.random() * 3 + 2,
        life: 1.0,
        decay: Math.random() * 0.4 + 0.3,
        color: Math.random() < 0.6 ? '#e2e8f0' : '#475569',
        isFeather: true,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 6
      });
    }
  }

  function createBiplaneDebris(x, y, vx, vy, scheme = 'player', speedMult = 1.0) {
    const isPlayer = scheme === 'player';
    const primaryColor = isPlayer ? '#2b7a78' : '#ffcc00';
    const wingColor = isPlayer ? '#3aafa9' : '#9b5de5';
    const accentColor = isPlayer ? '#def2f1' : '#111111';

    const baseVx = (vx || 0) * 0.4;
    const baseVy = (vy || 0) * 0.4;

    // Top Wing
    createDebrisPiece({
      x, y: y - 8,
      vx: baseVx + (Math.random() * 60 - 30) * speedMult,
      vy: baseVy - (Math.random() * 90 + 70) * speedMult,
      width: 22, height: 4,
      color: wingColor,
      accentColor: accentColor,
      type: 'wing',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 14
    });

    // Bottom Wing
    createDebrisPiece({
      x, y: y + 5,
      vx: baseVx + (Math.random() * 80 - 40) * speedMult,
      vy: baseVy - (Math.random() * 60 + 30) * speedMult,
      width: 20, height: 3.5,
      color: wingColor,
      type: 'wing',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 14
    });

    // Fuselage Front
    createDebrisPiece({
      x: x + 8, y,
      vx: baseVx + (Math.random() * 90 + 40) * speedMult,
      vy: baseVy - (Math.random() * 70 + 40) * speedMult,
      width: 14, height: 7,
      color: primaryColor,
      accentColor: '#17252a',
      type: 'fuselage',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 10
    });

    // Fuselage Rear
    createDebrisPiece({
      x: x - 8, y,
      vx: baseVx - (Math.random() * 90 + 40) * speedMult,
      vy: baseVy - (Math.random() * 60 + 30) * speedMult,
      width: 12, height: 6,
      color: primaryColor,
      type: 'fuselage',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 12
    });

    // Propeller
    createDebrisPiece({
      x: x + 14, y,
      vx: baseVx + (Math.random() * 110 + 60) * speedMult,
      vy: baseVy - (Math.random() * 100 + 40) * speedMult,
      width: 12, height: 2.5,
      color: '#e2e8f0',
      type: 'prop',
      rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 15)
    });

    // Tail Fin / Rudder
    createDebrisPiece({
      x: x - 16, y: y - 4,
      vx: baseVx - (Math.random() * 80 + 30) * speedMult,
      vy: baseVy - (Math.random() * 80 + 40) * speedMult,
      width: 6, height: 8,
      color: primaryColor,
      accentColor: accentColor,
      type: 'tail',
      smoking: false,
      rotSpeed: (Math.random() - 0.5) * 10
    });

    // Landing gear / wheel
    createDebrisPiece({
      x, y: y + 8,
      vx: baseVx + (Math.random() * 50 - 25) * speedMult,
      vy: baseVy + (Math.random() * 40 + 10) * speedMult,
      width: 4, height: 4,
      color: '#333333',
      type: 'wheel',
      bounce: 0.6
    });

    // Silk scarf for player
    if (isPlayer) {
      createDebrisPiece({
        x: x - 4, y: y - 5,
        vx: baseVx - Math.random() * 40 - 20,
        vy: baseVy - Math.random() * 40 - 10,
        width: 7, height: 3,
        color: '#ffffff',
        type: 'scarf',
        gravity: 40,
        decay: 0.5
      });
    }

    // 8 small splinters / embers
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 120 + 30) * speedMult;
      createDebrisPiece({
        x, y,
        vx: baseVx + Math.cos(angle) * spd,
        vy: baseVy + Math.sin(angle) * spd,
        width: Math.random() * 3 + 2,
        height: Math.random() * 3 + 2,
        color: Math.random() < 0.5 ? primaryColor : '#ff9900',
        smoking: Math.random() < 0.5,
        gravity: 120
      });
    }
  }

  function createAirlinerWingDebris(x, y, direction = -1) {
    const dirMult = direction === 1 ? 1 : -1;
    // Wing with engine pod falling off
    createDebrisPiece({
      x: x + dirMult * 4,
      y: y + 4,
      vx: dirMult * (Math.random() * 60 + 30),
      vy: -Math.random() * 40 - 20,
      width: 26,
      height: 12,
      color: '#ced4da',
      accentColor: '#495057',
      type: 'airliner_wing',
      smoking: true,
      rotSpeed: dirMult * (Math.random() * 3 + 2),
      gravity: 130,
      life: 4.0
    });

    // Extra sheared metal sparks and fire puffs
    for (let i = 0; i < 12; i++) {
      createFirePuff(x + dirMult * 4, y + 4, dirMult * 40, -20, 5);
    }
  }

  function createAirlinerDebris(x, y, vx, vy, count = 16) {
    // Airliner Hull Section (White/Blue)
    createDebrisPiece({
      x: x - 12, y: y - 4,
      vx: (vx || 0) * 0.4 + (Math.random() * 70 - 35),
      vy: -Math.random() * 80 - 40,
      width: 26, height: 12,
      color: '#f8f9fa',
      accentColor: '#003566',
      type: 'airliner_hull',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 8
    });

    // Airliner Nose Section
    createDebrisPiece({
      x: x + 16, y: y - 2,
      vx: (vx || 0) * 0.4 + (Math.random() * 80 + 20),
      vy: -Math.random() * 90 - 30,
      width: 16, height: 10,
      color: '#f8f9fa',
      accentColor: '#212529',
      type: 'airliner_nose',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 9
    });

    // Airliner Tail Fin
    createDebrisPiece({
      x: x - 20, y: y - 10,
      vx: (vx || 0) * 0.4 - (Math.random() * 80 + 20),
      vy: -Math.random() * 100 - 50,
      width: 14, height: 16,
      color: '#003566',
      accentColor: '#00b4d8',
      type: 'airliner_tail',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 7
    });

    // Jet Engine Pod
    createDebrisPiece({
      x: x, y: y + 6,
      vx: (vx || 0) * 0.4 + (Math.random() * 60 - 30),
      vy: -Math.random() * 60 - 20,
      width: 12, height: 6,
      color: '#495057',
      accentColor: '#00b4d8',
      type: 'engine',
      smoking: true,
      rotSpeed: (Math.random() - 0.5) * 12
    });

    // Multiple metallic fragments
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 140 + 40;
      createDebrisPiece({
        x, y,
        vx: (vx || 0) * 0.2 + Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        width: Math.random() * 5 + 3,
        height: Math.random() * 4 + 2,
        color: Math.random() < 0.4 ? '#f8f9fa' : Math.random() < 0.7 ? '#003566' : '#ff9900',
        smoking: Math.random() < 0.6,
        gravity: 140
      });
    }
  }

  function createHugeExplosion(x, y, count = 65) {
    state.shake = Math.min(state.shake + count * 0.35, 22);
    playSound('big_crash');

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 40;
      const r = Math.random();
      const color = r < 0.4 ? '#ff2200' : r < 0.75 ? '#ff9900' : '#ffe14c';

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        size: Math.random() * 6 + 3,
        life: 1.0,
        decay: Math.random() * 1.0 + 0.6,
        color,
        gravity: 80
      });
    }

    // Heavy dark smoke cloud expanding upwards
    for (let i = 0; i < 14; i++) {
      createSmokePuff(
        x + (Math.random() - 0.5) * 40,
        y - Math.random() * 20,
        (Math.random() - 0.5) * 40,
        -Math.random() * 50 - 20,
        Math.random() * 5 + 4,
        'rgba(40,40,40,'
      );
    }
  }

  function createNearMissBurst(x, y) {
    const colors = ['#00ffff', '#ffffff', '#70e000', '#ffd700'];
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 120 + 40;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 1.5,
        life: 0.7,
        decay: Math.random() * 1.5 + 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 20
      });
    }
  }

  // --- BALLOON ENTITY ---
  class Balloon {
    constructor(x, y, type = 'red') {
      this.x = x;
      this.y = y;
      this.baseY = y;
      this.type = type; // 'red', 'blue', 'green', 'gold', 'rainbow'
      this.id = `${Math.round(x)}_${Math.round(y)}_${type}`;
      this.radius = type === 'gold' ? 14 : 12;
      this.bobOffset = Math.random() * Math.PI * 2;
      this.bobSpeed = 2.0 + Math.random() * 1.5;
      this.stringSway = Math.random() * Math.PI * 2;
      this.popped = false;

      // Color palettes & Base point values
      if (type === 'red') {
        this.mainColor = '#e63946';
        this.highlightColor = '#ff858d';
        this.basePoints = 100;
      } else if (type === 'blue') {
        this.mainColor = '#1d3557';
        this.highlightColor = '#457b9d';
        this.basePoints = 150;
      } else if (type === 'green') {
        this.mainColor = '#2a9d8f';
        this.highlightColor = '#52b788';
        this.basePoints = 150;
      } else if (type === 'gold') {
        this.mainColor = '#f4a261';
        this.highlightColor = '#ffe3a8';
        this.basePoints = 300;
      } else if (type === 'rainbow') {
        this.mainColor = '#e76f51';
        this.highlightColor = '#ffffff';
        this.basePoints = 500;
      }

      // Altitude-dependent value scaling:
      // Base value at lowest balloon altitude (y ~ 410), 2x value at highest balloon altitude (y ~ 40)
      const LOWEST_BALLOON_ALT_Y = 410;
      const HIGHEST_BALLOON_ALT_Y = 40;
      const altProgress = Math.max(0, Math.min(1, (LOWEST_BALLOON_ALT_Y - this.baseY) / (LOWEST_BALLOON_ALT_Y - HIGHEST_BALLOON_ALT_Y)));
      const altMultiplier = 1.0 + altProgress;
      this.points = Math.round(this.basePoints * altMultiplier);
    }

    update(dt) {
      if (this.popped) return;
      const diffScale = getLevelSpeedScale();
      this.bobOffset += (this.bobSpeed * diffScale) * dt;
      this.stringSway += (3.0 * diffScale) * dt;
      this.y = this.baseY + Math.sin(this.bobOffset) * 6;
    }

    pop() {
      if (this.popped) return;
      this.popped = true;
      poppedBalloonKeys.add(this.id);

      // 1. Check Consecutive Pop along Horizontal Axis
      let isConsecutive = false;
      if (state.lastPoppedX !== null && state.lastPoppedId !== null) {
        const minX = Math.min(state.lastPoppedX, this.x);
        const maxX = Math.max(state.lastPoppedX, this.x);

        // Check if any unpopped balloon in the course was skipped strictly between minX and maxX
        const skipped = balloons.some(b => {
          return !b.popped && b.id !== this.id && b.id !== state.lastPoppedId && b.x > minX + 15 && b.x < maxX - 15;
        });

        if (!skipped) {
          isConsecutive = true;
        }
      }

      if (isConsecutive) {
        state.combo++;
      } else {
        state.combo = 1;
      }

      state.lastPoppedX = this.x;
      state.lastPoppedId = this.id;
      if (state.combo > state.maxCombo) {
        state.maxCombo = state.combo;
      }

      // 2. Score Calculation: Consecutive Multiplier (+5% per streak) + Stall Multiplier (2X)
      const inStall = !!(player && player.stalled && !player.isDead);
      const stallMult = inStall ? 2.0 : 1.0;
      const consecutiveMult = 1.0 + (state.combo - 1) * 0.05;
      const totalMult = consecutiveMult * stallMult;
      const earnedScore = Math.round(this.points * totalMult);
      const comboBonusPct = Math.round((state.combo - 1) * 5);

      // Particles & Audio
      createConfettiBurst(this.x, this.y, this.type === 'gold' ? 32 : 22, this.type === 'gold');
      playSound(this.type === 'gold' ? 'gold_pop' : 'pop', Math.min(state.combo, 10));

      addScore(earnedScore);
      state.balloonsPopped++;
      state.balloonsPoppedThisWave = (state.balloonsPoppedThisWave || 0) + 1;

      // 3. Floating Score & Multiplier Popups
      let label = `+${earnedScore}`;
      let floatColor = this.type === 'gold' ? '#ffd700' : '#ffffff';
      if (inStall && state.combo > 1) {
        label += ` (STALL 2X | +${comboBonusPct}%)`;
        floatColor = '#ffd700';
      } else if (inStall) {
        label += ` (STALL 2X!)`;
        floatColor = '#ffd700';
      } else if (state.combo > 1) {
        label += ` (+${comboBonusPct}%)`;
        floatColor = '#ff9900';
      }
      addFloatingText(this.x, this.y - 12, label, floatColor, 10);

      // 4. Special Banner Alerts for Bonuses & Combos (Top-Center)
      if (inStall) {
        if (state.combo > 1) {
          showStatusBanner(`★ STALL POP 2X! COMBO x${state.combo} (+${comboBonusPct}%) ★`, 2.0, 'bonus');
        } else {
          showStatusBanner('★ STALL POP BONUS! 2X POINTS ★', 2.0, 'bonus');
        }
      } else if (state.combo > 1 && (state.combo % 5 === 0 || state.combo === 2)) {
        if (state.combo === 2) {
          showStatusBanner(`CONSECUTIVE POP! +5% COMBO`, 1.5, 'combo');
        } else {
          showStatusBanner(`🔥 ${state.combo}X CONSECUTIVE COMBO! (+${comboBonusPct}%)`, 2.2, 'combo');
        }
      }

      // Course Wave Milestone (every 15 balloons popped)
      if (state.balloonsPoppedThisWave >= 15 && !state.gameOver) {
        state.balloonsPoppedThisWave = 0;
        state.wave++;
        playSound('stage_clear');
        const bonus = 1000 * (state.wave - 1);
        addScore(bonus);
        const speedBonusPct = Math.round((getLevelSpeedScale(state.wave) - 1) * 100);
        showStatusBanner(`COURSE CLEARED! BONUS +${bonus} (SECTOR ${state.wave} • SPEED +${speedBonusPct}%)`, 3.0, 'success');

        // Dynamically scale player and active hazards to new wave difficulty
        if (player && !player.isDead) {
          player.applyLevelSpeedScale();
        }
        for (const al of airliners) {
          al.applyLevelSpeedScale();
        }
        for (const sp of stuntPlanes) {
          sp.applyLevelSpeedScale();
        }
        for (const bf of birdFlocks) {
          bf.applyLevelSpeedScale();
        }
      }

      // Boost player speed slightly on pop for satisfying chain flow
      if (player && !player.isDead) {
        player.airspeed = Math.min(player.maxSpeed, player.airspeed + (this.type === 'gold' ? 20 : 10));
      }

      updateHUD();
    }

    draw(ctx, camX) {
      if (this.popped) return;
      const renderX = this.x - camX;

      ctx.save();

      // Dangling tether string with natural curve
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const stringBend = Math.sin(this.stringSway) * 4;
      ctx.moveTo(renderX, this.y + this.radius);
      ctx.quadraticCurveTo(renderX + stringBend, this.y + this.radius + 10, renderX, this.y + this.radius + 20);
      ctx.stroke();

      // Balloon body (oval shape)
      ctx.fillStyle = this.mainColor;
      ctx.beginPath();
      ctx.ellipse(renderX, this.y, this.radius, this.radius * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Top-left shine highlight
      ctx.fillStyle = this.highlightColor;
      ctx.beginPath();
      ctx.ellipse(renderX - this.radius * 0.35, this.y - this.radius * 0.4, this.radius * 0.3, this.radius * 0.5, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Bottom tie knot
      ctx.fillStyle = this.mainColor;
      ctx.beginPath();
      ctx.moveTo(renderX - 3, this.y + this.radius * 1.25);
      ctx.lineTo(renderX + 3, this.y + this.radius * 1.25);
      ctx.lineTo(renderX, this.y + this.radius * 1.25 + 4);
      ctx.closePath();
      ctx.fill();

      // Gold balloon star emblem
      if (this.type === 'gold') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', renderX, this.y);
      }

      ctx.restore();
    }
  }

  // --- LARGE DANCING FLAME RENDERING ---
  function drawLargeDancingFlame(ctx, renderX, baseY, width, height, t, alpha) {
    if (alpha <= 0) return;
    const currentWind = settings.wind ? wind.speed : 0;
    const windTilt = currentWind * 0.22;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Layer 1: Outer dancing flame (Rich Red-Orange)
    const tipX = renderX + Math.sin(t * 1.8) * (width * 0.24) + windTilt;
    const tipY = baseY - height * (0.84 + 0.10 * Math.sin(t * 2.2));

    ctx.fillStyle = '#ff3d00';
    ctx.beginPath();
    ctx.moveTo(renderX - width * 0.45, baseY);
    ctx.bezierCurveTo(
      renderX - width * (0.52 + 0.08 * Math.sin(t * 1.4)), baseY - height * 0.38,
      renderX - width * 0.14 + windTilt * 0.5, tipY + height * 0.25,
      tipX, tipY
    );
    ctx.bezierCurveTo(
      renderX + width * 0.14 + windTilt * 0.5, tipY + height * 0.25,
      renderX + width * (0.52 + 0.08 * Math.cos(t * 1.5)), baseY - height * 0.38,
      renderX + width * 0.45, baseY
    );
    ctx.closePath();
    ctx.fill();

    // Layer 2: Middle dancing flame (Vibrant Gold / Orange)
    const mWidth = width * 0.65;
    const mHeight = height * 0.72;
    const mTipX = renderX + Math.sin(t * 2.0 + 0.5) * (mWidth * 0.22) + windTilt * 0.8;
    const mTipY = baseY - mHeight * (0.84 + 0.10 * Math.cos(t * 2.5));

    ctx.fillStyle = '#ff9100';
    ctx.beginPath();
    ctx.moveTo(renderX - mWidth * 0.45, baseY);
    ctx.bezierCurveTo(
      renderX - mWidth * (0.52 + 0.08 * Math.sin(t * 1.6 + 0.3)), baseY - mHeight * 0.38,
      renderX - mWidth * 0.14 + windTilt * 0.4, mTipY + mHeight * 0.25,
      mTipX, mTipY
    );
    ctx.bezierCurveTo(
      renderX + mWidth * 0.14 + windTilt * 0.4, mTipY + mHeight * 0.25,
      renderX + mWidth * (0.52 + 0.08 * Math.cos(t * 1.7 + 0.3)), baseY - mHeight * 0.38,
      renderX + mWidth * 0.45, baseY
    );
    ctx.closePath();
    ctx.fill();

    // Layer 3: Inner core (Bright Yellow-White)
    const cWidth = width * 0.35;
    const cHeight = height * 0.45;
    const cTipX = renderX + Math.sin(t * 2.3 + 1.0) * (cWidth * 0.18) + windTilt * 0.5;
    const cTipY = baseY - cHeight * (0.86 + 0.08 * Math.sin(t * 2.8));

    ctx.fillStyle = '#fff59d';
    ctx.beginPath();
    ctx.moveTo(renderX - cWidth * 0.45, baseY);
    ctx.bezierCurveTo(
      renderX - cWidth * 0.48, baseY - cHeight * 0.38,
      renderX - cWidth * 0.1 + windTilt * 0.3, cTipY + cHeight * 0.25,
      cTipX, cTipY
    );
    ctx.bezierCurveTo(
      renderX + cWidth * 0.1 + windTilt * 0.3, cTipY + cHeight * 0.25,
      renderX + cWidth * 0.48, baseY - cHeight * 0.38,
      renderX + cWidth * 0.45, baseY
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // --- COUNTRYSIDE STRUCTURES & BARNYARD ---
  class CountryStructure {
    constructor(x, type = 'barn') {
      this.x = x;
      this.type = type; // 'barn', 'house', 'windmill', 'silo_set', 'water_tower', 'church'
      this.nearMissAwarded = false;
      this.nearMissPending = false;
      this.flames = [];

      if (type === 'barn') {
        this.width = 140;
        this.height = 85;
        this.y = GROUND_Y - this.height;
        this.gapTop = 428;
        this.gapBottom = 470;
        this.gapHeight = this.gapBottom - this.gapTop;
        this.barnStormPending = false;
        this.barnStormAwarded = false;
        this.entryDir = 0;
      } else if (type === 'house') {
        this.width = 85;
        this.height = 55;
        this.y = GROUND_Y - this.height;
      } else if (type === 'windmill') {
        this.width = 40;
        this.height = 110;
        this.y = GROUND_Y - this.height;
        this.bladeAngle = Math.random() * Math.PI * 2;
      } else if (type === 'silo_set') {
        this.width = 95;
        this.height = 90;
        this.y = GROUND_Y - this.height;
      } else if (type === 'water_tower') {
        this.width = 50;
        this.height = 95;
        this.y = GROUND_Y - this.height;
      } else if (type === 'church') {
        this.width = 90;
        this.height = 115;
        this.y = GROUND_Y - this.height;
      }
    }

    ignite(mult = 1.0) {
      playSound('fire_ignite');
      // Create 2-3 large dancing flames randomly offset across the building, starting at ground level
      const count = Math.random() < 0.5 ? 2 : 3;
      this.flames = [];
      for (let i = 0; i < count; i++) {
        const offsetRatio = (i + 0.3 + Math.random() * 0.4) / count;
        const fx = this.x + Math.max(12, Math.min(this.width - 12, offsetRatio * this.width));
        const dur = (2.0 + Math.random() * 1.0) * mult; // 2 to 3 seconds
        const fWidth = 32 + Math.random() * 10;
        const fHeight = Math.max(48, this.height * (0.72 + Math.random() * 0.20));
        this.flames.push({
          x: fx,
          width: fWidth,
          height: fHeight,
          life: dur,
          maxLife: dur,
          phase: Math.random() * 10,
          smokeTimer: Math.random() * 0.1
        });
      }
    }

    update(dt) {
      if (this.type === 'windmill') {
        const diffScale = getLevelSpeedScale();
        this.bladeAngle += (1.4 * diffScale) * dt; // Spinning windmill sails
      }

      if (this.flames.length > 0) {
        const currentWind = settings.wind ? wind.speed : 0;
        for (let i = this.flames.length - 1; i >= 0; i--) {
          const f = this.flames[i];
          f.life -= dt;
          f.smokeTimer += dt;

          // Each flame has a bit of smoke effect going up
          if (f.smokeTimer >= 0.20) {
            f.smokeTimer = 0;
            const smokeX = f.x + (settings.wind ? (wind.speed * 0.15) : 0);
            const smokeY = GROUND_Y - f.height * 0.85;
            createSmokePuff(
              smokeX + (Math.random() - 0.5) * 6,
              smokeY,
              currentWind * 0.25,
              -Math.random() * 25 - 15,
              3.5 + Math.random() * 2.0,
              'rgba(90,90,90,'
            );
          }

          if (f.life <= 0) {
            this.flames.splice(i, 1);
          }
        }
      }
    }

    // Check collision with airplane
    checkCollision(plane) {
      if (plane.isDead || (plane.invulnerableTimer && plane.invulnerableTimer > 0)) return false;
      const px = plane.x;
      const py = plane.y;

      if (this.type === 'barn') {
        const halfW = (plane.width || 34) * 0.40;
        const halfH = (plane.height || 18) * 0.38;
        const pLeft = px - halfW;
        const pRight = px + halfW;
        const pTop = py - halfH;
        const pBottom = py + halfH;

        // Check horizontal overlap across the barn
        if (pRight >= this.x && pLeft <= this.x + this.width) {
          // 1. Top Hitbox: Gambrel roof & upper hayloft
          if (pTop <= this.gapTop && pBottom >= this.y) {
            return true;
          }
          // 2. Bottom Hitbox: Foundation & ground threshold
          if (pBottom >= this.gapBottom && pTop <= GROUND_Y) {
            return true;
          }
          // Inside the vertical fly-through corridor (this.gapTop to this.gapBottom): clear flight!
        }
      } else if (this.type === 'house') {
        if (px >= this.x && px <= this.x + this.width && py >= this.y && py <= GROUND_Y) {
          return true;
        }
      } else if (this.type === 'windmill') {
        // Tower base + spinning blades
        if (px >= this.x && px <= this.x + this.width && py >= this.y && py <= GROUND_Y) {
          return true;
        }
        // Hub collision
        const hubY = this.y + 16;
        const hubX = this.x + 20;
        if (Math.hypot(px - hubX, py - hubY) < 32) {
          return true;
        }
      } else if (this.type === 'silo_set') {
        if (px >= this.x && px <= this.x + this.width && py >= this.y && py <= GROUND_Y) {
          return true;
        }
      } else if (this.type === 'water_tower') {
        if (px >= this.x && px <= this.x + this.width && py >= this.y && py <= GROUND_Y) {
          return true;
        }
      } else if (this.type === 'church') {
        // Two rectangular hitboxes:
        // 1. Steeple rect (tall tower & spire on left)
        if (px >= this.x && px <= this.x + 28 && py >= this.y && py <= GROUND_Y) {
          return true;
        }
        // 2. Chapel building + roof rect (lower half on right)
        if (px > this.x + 28 && px <= this.x + this.width && py >= this.y + 42 && py <= GROUND_Y) {
          return true;
        }
      }
      return false;
    }

    // Check collision with large aircraft (such as crashing airliners)
    checkAirlinerCollision(al) {
      if (al.isDead) return false;
      const alLeft = al.x - 38;
      const alRight = al.x + 38;
      const alTop = al.y - 12;
      const alBottom = al.y + 12;

      // Horizontal overlap
      const hOverlap = alRight >= this.x && alLeft <= this.x + this.width;
      if (!hOverlap) return false;

      if (this.type === 'church') {
        // Steeple tower
        const steepleOverlap = (alRight >= this.x && alLeft <= this.x + 28 && alBottom >= this.y && alTop <= GROUND_Y);
        // Chapel nave
        const chapelOverlap = (alRight > this.x + 28 && alLeft <= this.x + this.width && alBottom >= this.y + 42 && alTop <= GROUND_Y);
        return steepleOverlap || chapelOverlap;
      }

      return alBottom >= this.y && alTop <= GROUND_Y;
    }

    draw(ctx, camX) {
      const rx = this.x - camX;

      if (this.type === 'barn') {
        // --- BARN INTERIOR BREEZEWAY (Rendered behind player) ---
        // 1. Darkened rustic timber interior back wall
        ctx.fillStyle = '#26120c';
        ctx.fillRect(rx + 4, this.gapTop - 4, this.width - 8, this.gapHeight + 4);

        // Vertical interior plank boards
        ctx.strokeStyle = '#1b0c08';
        ctx.lineWidth = 1.5;
        for (let bx = rx + 16; bx < rx + this.width - 12; bx += 14) {
          ctx.beginPath();
          ctx.moveTo(bx, this.gapTop - 4);
          ctx.lineTo(bx, this.gapBottom);
          ctx.stroke();
        }

        // Interior roof rafters / cross trusses visible in the breezeway ceiling
        ctx.strokeStyle = '#180a07';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let bx = rx + 10; bx < rx + this.width - 20; bx += 24) {
          ctx.moveTo(bx, this.gapTop);
          ctx.lineTo(bx + 12, this.gapTop - 6);
          ctx.lineTo(bx + 24, this.gapTop);
        }
        ctx.stroke();

        // Straw-strewn earthen floor inside the barn
        ctx.fillStyle = '#3a2618';
        ctx.fillRect(rx + 4, this.gapBottom - 3, this.width - 8, 3);
        ctx.fillStyle = '#b8860b';
        // Flecks of gold straw on the floor
        for (let sX = rx + 12; sX < rx + this.width - 12; sX += 16) {
          ctx.fillRect(sX, this.gapBottom - 2, 4, 1.5);
        }

        // Interior depth shading: center tunnel shadow, light spilling in from open doors
        const grad = ctx.createLinearGradient(rx, 0, rx + this.width, 0);
        grad.addColorStop(0, 'rgba(255, 230, 180, 0.15)');
        grad.addColorStop(0.2, 'rgba(0, 0, 0, 0.35)');
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.55)');
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.35)');
        grad.addColorStop(1, 'rgba(255, 230, 180, 0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(rx + 4, this.gapTop, this.width - 8, this.gapHeight);

        // --- OBVIOUSLY OPEN DOORS ON BOTH ENDS ---
        ctx.save();
        // Left Open Barn Door (swung wide open outward to the west)
        ctx.fillStyle = '#781c1c';
        ctx.strokeStyle = '#4a0f0f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx + 2, this.gapTop);
        ctx.lineTo(rx - 14, this.gapTop + 3);
        ctx.lineTo(rx - 14, this.gapBottom + 2);
        ctx.lineTo(rx + 2, this.gapBottom);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // White X-cross brace on open left door
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx - 12, this.gapTop + 5);
        ctx.lineTo(rx, this.gapBottom - 2);
        ctx.moveTo(rx, this.gapTop + 2);
        ctx.lineTo(rx - 12, this.gapBottom);
        ctx.stroke();

        // Black heavy iron hinges
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(rx - 2, this.gapTop + 4, 6, 3);
        ctx.fillRect(rx - 2, this.gapBottom - 7, 6, 3);

        // Right Open Barn Door (swung wide open outward to the east)
        ctx.fillStyle = '#781c1c';
        ctx.strokeStyle = '#4a0f0f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx + this.width - 2, this.gapTop);
        ctx.lineTo(rx + this.width + 14, this.gapTop + 3);
        ctx.lineTo(rx + this.width + 14, this.gapBottom + 2);
        ctx.lineTo(rx + this.width - 2, this.gapBottom);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // White X-cross brace on open right door
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx + this.width, this.gapTop + 2);
        ctx.lineTo(rx + this.width + 12, this.gapBottom);
        ctx.moveTo(rx + this.width + 12, this.gapTop + 5);
        ctx.lineTo(rx + this.width, this.gapBottom - 2);
        ctx.stroke();

        // Black heavy iron hinges
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(rx + this.width - 4, this.gapTop + 4, 6, 3);
        ctx.fillRect(rx + this.width - 4, this.gapBottom - 7, 6, 3);
        ctx.restore();

      } else if (this.type === 'house') {
        // Country Farmhouse
        ctx.fillStyle = '#eae2d6';
        ctx.fillRect(rx, this.y + 22, 85, 33);

        // Windows with warm light
        ctx.fillStyle = '#ffeaa7';
        ctx.fillRect(rx + 12, this.y + 30, 14, 14);
        ctx.fillRect(rx + 58, this.y + 30, 14, 14);
        ctx.strokeStyle = '#5a4d41';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx + 12, this.y + 30, 14, 14);
        ctx.strokeRect(rx + 58, this.y + 30, 14, 14);

        // Door
        ctx.fillStyle = '#6b4c35';
        ctx.fillRect(rx + 36, this.y + 34, 14, 21);

        // Roof
        ctx.fillStyle = '#4a5568';
        ctx.beginPath();
        ctx.moveTo(rx - 6, this.y + 22);
        ctx.lineTo(rx + 42, this.y);
        ctx.lineTo(rx + 91, this.y + 22);
        ctx.closePath();
        ctx.fill();

        // Chimney with smoke
        ctx.fillStyle = '#8b263e';
        ctx.fillRect(rx + 62, this.y - 10, 10, 18);
        if (Math.random() < 0.25) {
          createSmokePuff(this.x + 67, this.y - 10, 5, -15, 3, 'rgba(220,220,220,');
        }

      } else if (this.type === 'windmill') {
        // Windmill Tower (wooden lattice)
        ctx.fillStyle = '#795548';
        ctx.beginPath();
        ctx.moveTo(rx + 8, GROUND_Y);
        ctx.lineTo(rx + 14, this.y + 16);
        ctx.lineTo(rx + 26, this.y + 16);
        ctx.lineTo(rx + 32, GROUND_Y);
        ctx.closePath();
        ctx.fill();

        // Cross braces
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let yb = this.y + 28; yb < GROUND_Y; yb += 20) {
          ctx.moveTo(rx + 10, yb);
          ctx.lineTo(rx + 30, yb + 12);
          ctx.moveTo(rx + 30, yb);
          ctx.lineTo(rx + 10, yb + 12);
        }
        ctx.stroke();

        // Rotor Hub & Spinning Sails
        const hubX = rx + 20;
        const hubY = this.y + 16;
        ctx.save();
        ctx.translate(hubX, hubY);
        ctx.rotate(this.bladeAngle);

        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          // Blade spar
          ctx.strokeStyle = '#3e2723';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -38);
          ctx.stroke();
          // Blade canvas sail
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(2, -36, 8, 28);
        }

        // Center hub cap
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (this.type === 'silo_set') {
        // Double Grain Silos
        ctx.fillStyle = '#b0bec5';
        ctx.fillRect(rx + 6, this.y + 15, 36, 75);
        ctx.fillRect(rx + 48, this.y + 15, 36, 75);

        // Silo Domes
        ctx.fillStyle = '#78909c';
        ctx.beginPath();
        ctx.arc(rx + 24, this.y + 15, 18, Math.PI, 0);
        ctx.arc(rx + 66, this.y + 15, 18, Math.PI, 0);
        ctx.fill();

        // Connecting catwalk
        ctx.fillStyle = '#455a64';
        ctx.fillRect(rx + 38, this.y + 30, 14, 4);

      } else if (this.type === 'water_tower') {
        // Wooden Stilt Water Tower
        ctx.fillStyle = '#6d4c41';
        // Legs
        ctx.fillRect(rx + 8, this.y + 45, 6, 50);
        ctx.fillRect(rx + 36, this.y + 45, 6, 50);
        // Crossbeams
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx + 8, this.y + 45);
        ctx.lineTo(rx + 42, GROUND_Y);
        ctx.moveTo(rx + 42, this.y + 45);
        ctx.lineTo(rx + 8, GROUND_Y);
        ctx.stroke();

        // Water Tank Barrel
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(rx + 5, this.y + 14, 40, 32);
        // Metal Hoops
        ctx.strokeStyle = '#37474f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx + 5, this.y + 20);
        ctx.lineTo(rx + 45, this.y + 20);
        ctx.moveTo(rx + 5, this.y + 36);
        ctx.lineTo(rx + 45, this.y + 36);
        ctx.stroke();

        // Conical Roof
        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.moveTo(rx + 2, this.y + 14);
        ctx.lineTo(rx + 25, this.y);
        ctx.lineTo(rx + 48, this.y + 14);
        ctx.closePath();
        ctx.fill();

      } else if (this.type === 'church') {
        // Country Chapel & Bell Steeple
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(rx + 25, this.y + 55, 65, 60); // Chapel nave
        ctx.fillRect(rx + 4, this.y + 30, 24, 85);  // Steeple tower

        // Steeple Spire
        ctx.fillStyle = '#37474f';
        ctx.beginPath();
        ctx.moveTo(rx + 2, this.y + 30);
        ctx.lineTo(rx + 16, this.y);
        ctx.lineTo(rx + 30, this.y + 30);
        ctx.closePath();
        ctx.fill();

        // Cross on Spire
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx + 16, this.y);
        ctx.lineTo(rx + 16, this.y - 8);
        ctx.moveTo(rx + 13, this.y - 5);
        ctx.lineTo(rx + 19, this.y - 5);
        ctx.stroke();

        // Chapel Roof
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath();
        ctx.moveTo(rx + 25, this.y + 55);
        ctx.lineTo(rx + 58, this.y + 35);
        ctx.lineTo(rx + 92, this.y + 55);
        ctx.closePath();
        ctx.fill();

        // Arched Windows
        ctx.fillStyle = '#90caf9';
        ctx.fillRect(rx + 42, this.y + 68, 12, 18);
        ctx.fillRect(rx + 68, this.y + 68, 12, 18);
        ctx.fillRect(rx + 11, this.y + 50, 10, 14);
      }

      // Draw 2-3 large dancing flames overlaid on top of building with bottom starting at ground level (non-barn buildings)
      if (this.type !== 'barn' && this.flames && this.flames.length > 0) {
        const nowSec = Date.now() * 0.0038;
        for (const f of this.flames) {
          const rx = f.x - camX;
          let alpha = 1.0;
          if (f.life > f.maxLife - 0.25) {
            alpha = (f.maxLife - f.life) / 0.25;
          } else if (f.life < 0.6) {
            alpha = f.life / 0.6;
          }
          drawLargeDancingFlame(ctx, rx, GROUND_Y, f.width, f.height, nowSec + f.phase, Math.max(0, Math.min(1.0, alpha)));
        }
      }
    }

    // Foreground pass (rendered on top of player biplane and other hazards)
    drawForeground(ctx, camX) {
      if (this.type !== 'barn') return;
      const rx = this.x - camX;

      ctx.save();

      // 1. Stone Foundation along the base (GROUND_Y - 10 to GROUND_Y)
      ctx.fillStyle = '#475569';
      ctx.fillRect(rx + 2, this.gapBottom, this.width - 4, GROUND_Y - this.gapBottom);
      ctx.fillStyle = '#334155';
      ctx.fillRect(rx + 2, GROUND_Y - 2, this.width - 4, 2);
      // Mortar block joints
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let bx = rx + 14; bx < rx + this.width; bx += 20) {
        ctx.moveTo(bx, this.gapBottom);
        ctx.lineTo(bx, GROUND_Y);
      }
      ctx.stroke();

      // 2. Front Wall Facade (obscures the player biplane as it flies inside)
      // Spans between the left open door (rx + 26) and right open door (rx + this.width - 26)
      const fwLeft = rx + 26;
      const fwRight = rx + this.width - 26;
      const fwWidth = fwRight - fwLeft;

      // Solid red front wall
      ctx.fillStyle = '#a62b2b';
      ctx.fillRect(fwLeft, this.gapTop, fwWidth, this.gapHeight);

      // Vertical board plank lines
      ctx.strokeStyle = '#851e1e';
      ctx.lineWidth = 1.5;
      for (let px = fwLeft + 10; px < fwRight; px += 11) {
        ctx.beginPath();
        ctx.moveTo(px, this.gapTop);
        ctx.lineTo(px, this.gapBottom);
        ctx.stroke();
      }

      // White X-braces across the front wall
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      const midFw = fwLeft + fwWidth / 2;
      // Left X-brace panel
      ctx.strokeRect(fwLeft + 4, this.gapTop + 4, midFw - fwLeft - 8, this.gapHeight - 8);
      ctx.beginPath();
      ctx.moveTo(fwLeft + 4, this.gapTop + 4);
      ctx.lineTo(midFw - 4, this.gapBottom - 4);
      ctx.moveTo(midFw - 4, this.gapTop + 4);
      ctx.lineTo(fwLeft + 4, this.gapBottom - 4);
      // Right X-brace panel
      ctx.moveTo(midFw + 4, this.gapTop + 4);
      ctx.lineTo(fwRight - 4, this.gapBottom - 4);
      ctx.moveTo(fwRight - 4, this.gapTop + 4);
      ctx.lineTo(midFw + 4, this.gapBottom - 4);
      ctx.stroke();
      ctx.strokeRect(midFw + 4, this.gapTop + 4, fwRight - midFw - 8, this.gapHeight - 8);

      // White Timber Jamb Posts framing the open doorways
      ctx.fillStyle = '#ffffff';
      // Left doorway jamb post
      ctx.fillRect(fwLeft - 2, this.gapTop - 2, 4, this.gapHeight + 4);
      // Right doorway jamb post
      ctx.fillRect(fwRight - 2, this.gapTop - 2, 4, this.gapHeight + 4);
      // Far outer jamb posts at the ends of the barn
      ctx.fillRect(rx, this.gapTop - 2, 3, this.gapHeight + 4);
      ctx.fillRect(rx + this.width - 3, this.gapTop - 2, 3, this.gapHeight + 4);

      // Heavy Doorway Header / Lintel Beam across the doorways and front wall
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(rx, this.gapTop - 4, this.width, 5);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, this.gapTop - 4, this.width, 5);

      // 3. Upper Hayloft Wall (from this.y + 24 to this.gapTop)
      ctx.fillStyle = '#9e2626';
      ctx.fillRect(rx + 2, this.y + 24, this.width - 4, this.gapTop - (this.y + 24));

      // Upper wall plank lines
      ctx.strokeStyle = '#7c1c1c';
      ctx.lineWidth = 1.5;
      for (let px = rx + 14; px < rx + this.width - 4; px += 14) {
        ctx.beginPath();
        ctx.moveTo(px, this.y + 24);
        ctx.lineTo(px, this.gapTop - 4);
        ctx.stroke();
      }

      // Hayloft Door / Window in upper wall center
      const hwX = rx + this.width / 2 - 13;
      const hwY = this.y + 28;
      ctx.fillStyle = '#1e0c08';
      ctx.fillRect(hwX, hwY, 26, 22); // Dark interior
      // Warm amber lantern glow
      ctx.fillStyle = 'rgba(255, 204, 0, 0.4)';
      ctx.fillRect(hwX + 4, hwY + 3, 18, 16);
      // Hay spilling out of the loft window
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(hwX + 3, hwY + 22);
      ctx.lineTo(hwX + 7, hwY + 27);
      ctx.lineTo(hwX + 13, hwY + 23);
      ctx.lineTo(hwX + 19, hwY + 28);
      ctx.lineTo(hwX + 23, hwY + 22);
      ctx.closePath();
      ctx.fill();
      // White window frame & center mullion
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(hwX, hwY, 26, 22);
      ctx.beginPath();
      ctx.moveTo(hwX + 13, hwY);
      ctx.lineTo(hwX + 13, hwY + 22);
      ctx.stroke();

      // 4. Classic Gambrel Roof (double-sloped gambrel roof profile)
      const roofMid = rx + this.width / 2;
      ctx.fillStyle = '#6b1c1c';
      ctx.beginPath();
      ctx.moveTo(rx - 6, this.y + 24);
      ctx.lineTo(rx + 28, this.y + 7);
      ctx.lineTo(roofMid, this.y);
      ctx.lineTo(rx + this.width - 28, this.y + 7);
      ctx.lineTo(rx + this.width + 6, this.y + 24);
      ctx.closePath();
      ctx.fill();

      // Roof shading (right slope slightly darker)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.moveTo(roofMid, this.y);
      ctx.lineTo(rx + this.width - 28, this.y + 7);
      ctx.lineTo(rx + this.width + 6, this.y + 24);
      ctx.lineTo(roofMid, this.y + 24);
      ctx.closePath();
      ctx.fill();

      // White fascia and roof trim
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(rx - 7, this.y + 24);
      ctx.lineTo(rx + 28, this.y + 7);
      ctx.lineTo(roofMid, this.y);
      ctx.lineTo(rx + this.width - 28, this.y + 7);
      ctx.lineTo(rx + this.width + 7, this.y + 24);
      ctx.stroke();

      // 5. Rooftop Cupola & Golden Weather Vane
      const cupolaX = roofMid - 9;
      const cupolaY = this.y - 12;
      // White cupola box
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cupolaX, cupolaY, 18, 12);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(cupolaX, cupolaY, 18, 12);
      // Cupola louvers
      ctx.fillStyle = '#334155';
      ctx.fillRect(cupolaX + 3, cupolaY + 3, 12, 2);
      ctx.fillRect(cupolaX + 3, cupolaY + 7, 12, 2);
      // Cupola roof
      ctx.fillStyle = '#6b1c1c';
      ctx.beginPath();
      ctx.moveTo(cupolaX - 2, cupolaY);
      ctx.lineTo(roofMid, cupolaY - 8);
      ctx.lineTo(cupolaX + 20, cupolaY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Weather Vane Spire & Rooster
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(roofMid, cupolaY - 8);
      ctx.lineTo(roofMid, cupolaY - 20);
      ctx.moveTo(roofMid - 5, cupolaY - 14);
      ctx.lineTo(roofMid + 5, cupolaY - 14);
      ctx.stroke();
      // Golden Rooster
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(roofMid, cupolaY - 21, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(roofMid - 4, cupolaY - 23, 7, 3);

      ctx.restore();

      // 6. Draw 2-3 large dancing flames overlaid on top of front wall & roof if ignited
      if (this.flames && this.flames.length > 0) {
        const nowSec = Date.now() * 0.0038;
        for (const f of this.flames) {
          const fx = f.x - camX;
          let alpha = 1.0;
          if (f.life > f.maxLife - 0.25) {
            alpha = (f.maxLife - f.life) / 0.25;
          } else if (f.life < 0.6) {
            alpha = f.life / 0.6;
          }
          drawLargeDancingFlame(ctx, fx, GROUND_Y, f.width, f.height, nowSec + f.phase, Math.max(0, Math.min(1.0, alpha)));
        }
      }
    }
  }

  // --- OBSTACLES: AIRLINERS (STEADY AIR TRAFFIC) ---
  class Airliner {
    constructor(x, y, speed = 90, direction = -1) {
      const diffScale = getLevelSpeedScale();
      this.x = x;
      this.y = y;
      this.baseSpeed = speed;
      this.speed = speed * diffScale;
      this.direction = direction; // -1 = West (Left), 1 = East (Right)
      this.vx = this.speed * direction;
      this.width = 88;
      this.height = 24;
      this.contrailTimer = 0;
      this.isDead = false;
      this.isCrashing = false;
      this.hasLostWing = false;
      this.nearMissAwarded = false;
      this.nearMissPending = false;
      this.crashAngle = 0;
      this.crashRotSpeed = 0;
      this.crashVy = 0;
      this.crashSmokeTimer = 0;
    }

    applyLevelSpeedScale() {
      const diffScale = getLevelSpeedScale();
      this.speed = this.baseSpeed * diffScale;
      if (!this.isCrashing) {
        this.vx = this.speed * this.direction;
      }
    }

    triggerCrash(hitX, hitY) {
      if (this.isCrashing || this.isDead) return;
      const diffScale = getLevelSpeedScale();
      this.isCrashing = true;
      this.hasLostWing = true;
      this.crashVy = 40 * diffScale;
      this.crashRotSpeed = this.direction * 1.35 * diffScale; // Banks steeply towards the severed wing
      playSound('wing_tear');
      createAirlinerWingDebris(this.x, this.y, this.direction);
      createExplosion(hitX || this.x, hitY || this.y, 35);
    }

    update(dt) {
      if (this.isDead) return;
      const diffScale = getLevelSpeedScale();

      if (this.isCrashing) {
        // Uncontrolled smoky banking dive
        this.crashVy += (170 * diffScale) * dt;
        this.crashAngle += this.crashRotSpeed * dt;
        this.x += this.vx * 0.95 * dt;
        this.y += this.crashVy * dt;

        // Heavy dark smoke and flame streaming from severed wing root
        this.crashSmokeTimer += dt;
        if (this.crashSmokeTimer > 0.025) {
          this.crashSmokeTimer = 0;
          const wingRootX = this.direction === 1 ? this.x - 4 : this.x + 4;
          const wingRootY = this.y + 4;
          createSmokePuff(wingRootX, wingRootY, -this.vx * 0.2, -this.crashVy * 0.2, 5.5, 'rgba(30,30,30,');
          createSmokePuff(wingRootX + (Math.random() - 0.5) * 8, wingRootY, -this.vx * 0.1, -this.crashVy * 0.1, 4.0, 'rgba(70,70,70,');
          if (Math.random() < 0.45) {
            createFirePuff(wingRootX, wingRootY, -this.vx * 0.15, -this.crashVy * 0.15, 4.5);
          }
        }

        // Structure Collision Detonation (Set building ablaze!)
        for (const s of structures) {
          if (s.checkAirlinerCollision(this)) {
            this.isDead = true;
            s.ignite(1.25);
            createHugeExplosion(this.x, this.y, 85);
            createAirlinerDebris(this.x, this.y, this.vx * 0.5, -45, 20);
            state.shake = Math.min(state.shake + 16, 24);
            const names = {
              barn: 'BARN',
              house: 'HOUSE',
              windmill: 'WINDMILL',
              silo_set: 'SILO',
              water_tower: 'WATER TOWER',
              church: 'CHURCH'
            };
            const structName = names[s.type] || 'BUILDING';
            showStatusBanner(`AIRLINER CRASHED INTO ${structName}!`, 2.5, 'danger');
            return;
          }
        }

        // Airfield Hangar Collision
        for (const af of airfields) {
          if (af.hangarX !== undefined) {
            const hx = af.hangarX;
            if (this.x >= hx - 20 && this.x <= hx + 62 && this.y >= GROUND_Y - 36) {
              this.isDead = true;
              if (af.igniteHangar) af.igniteHangar();
              createHugeExplosion(this.x, this.y, 85);
              createAirlinerDebris(this.x, this.y, this.vx * 0.5, -45, 20);
              state.shake = Math.min(state.shake + 16, 24);
              showStatusBanner('AIRLINER CRASHED INTO HANGAR!', 2.5, 'danger');
              return;
            }
          }
        }

        // Ground Impact Detonation
        if (this.y >= GROUND_Y - 10) {
          this.isDead = true;
          createHugeExplosion(this.x, GROUND_Y - 6, 80);
          createAirlinerDebris(this.x, GROUND_Y - 8, this.vx * 0.5, -50, 18);
          showStatusBanner('AIRLINER IMPACT DETONATION!', 2.5);
        }
        return;
      }

      this.x += this.vx * dt;

      // Check collision with Country Structures while flying
      for (const s of structures) {
        if (s.checkAirlinerCollision(this)) {
          this.isDead = true;
          s.ignite(1.25);
          createHugeExplosion(this.x, this.y, 85);
          createAirlinerDebris(this.x, this.y, this.vx * 0.5, -45, 20);
          state.shake = Math.min(state.shake + 16, 24);
          const names = {
            barn: 'BARN',
            house: 'HOUSE',
            windmill: 'WINDMILL',
            silo_set: 'SILO',
            water_tower: 'WATER TOWER',
            church: 'CHURCH'
          };
          const structName = names[s.type] || 'BUILDING';
          showStatusBanner(`AIRLINER CRASHED INTO ${structName}!`, 2.5, 'danger');
          return;
        }
      }

      // Jet Contrails
      this.contrailTimer += dt;
      if (this.contrailTimer > 0.05) {
        this.contrailTimer = 0;
        const tailX = this.direction === 1 ? this.x - 36 : this.x + 36;
        createSmokePuff(tailX, this.y - 2, -this.vx * 0.15, 0, 4, 'rgba(255,255,255,');
        createSmokePuff(tailX, this.y + 6, -this.vx * 0.15, 0, 4, 'rgba(255,255,255,');
      }
    }

    checkCollision(plane) {
      if (this.isDead || this.isCrashing || plane.isDead || (plane.invulnerableTimer && plane.invulnerableTimer > 0)) return false;
      const dx = Math.abs(plane.x - this.x);
      const dy = Math.abs(plane.y - this.y);
      return (dx < 42 && dy < 16);
    }

    draw(ctx, camX) {
      if (this.isDead) return;
      const rx = this.x - camX;
      ctx.save();
      ctx.translate(rx, this.y);
      if (this.isCrashing) {
        ctx.rotate(this.crashAngle);
      }
      if (this.direction === -1) {
        ctx.scale(-1, 1);
      }

      // Main Fuselage (White airliner)
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(-38, -7, 72, 14);
      // Nose Cone
      ctx.beginPath();
      ctx.moveTo(34, -7);
      ctx.lineTo(46, 0);
      ctx.lineTo(34, 7);
      ctx.closePath();
      ctx.fill();

      // Airline Stripe (Navy blue & cyan)
      ctx.fillStyle = '#003566';
      ctx.fillRect(-36, 0, 74, 3);
      ctx.fillStyle = '#00b4d8';
      ctx.fillRect(-36, 3, 74, 1.5);

      // Cockpit Windshield & Passenger Windows
      ctx.fillStyle = '#212529';
      ctx.fillRect(28, -5, 6, 3); // Cockpit
      for (let wx = -28; wx <= 20; wx += 6) {
        ctx.fillRect(wx, -4, 3, 3); // Passenger windows
      }

      // Wings & Engines
      if (!this.hasLostWing) {
        // Swept Wings
        ctx.fillStyle = '#ced4da';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-4, 16);
        ctx.lineTo(8, 16);
        ctx.lineTo(12, 0);
        ctx.closePath();
        ctx.fill();

        // Jet Engines under wings
        ctx.fillStyle = '#495057';
        ctx.fillRect(-2, 8, 12, 5);
        ctx.fillStyle = '#00b4d8';
        ctx.fillRect(10, 9, 2, 3); // Fan glow
      } else {
        // Jagged sheared wing stump with sparks and scorch
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-6, 5);
        ctx.lineTo(-1, 2);
        ctx.lineTo(4, 6);
        ctx.lineTo(10, 0);
        ctx.closePath();
        ctx.fill();

        // Glowing severed root
        ctx.fillStyle = '#ff4500';
        ctx.fillRect(-4, 1, 8, 3);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-2, 2, 4, 2);
      }

      // Tail Fin (Vertical Stabilizer)
      ctx.fillStyle = '#003566';
      ctx.beginPath();
      ctx.moveTo(-38, -7);
      ctx.lineTo(-46, -22);
      ctx.lineTo(-32, -22);
      ctx.lineTo(-24, -7);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  // --- OBSTACLES: STUNT BIPLANES (ACROBATIC COMPETITORS) ---
  class StuntBiplane {
    constructor(x, y, pattern = 'loop') {
      const diffScale = getLevelSpeedScale();
      this.x = x;
      this.y = y;
      this.pattern = pattern; // 'loop', 'wave'
      this.theta = Math.PI; // Heading West initially
      this.baseAirspeed = 122; // Base speed
      this.airspeed = 122 * diffScale;
      this.vx = -this.airspeed;
      this.vy = 0;
      this.timer = Math.random() * Math.PI * 2;
      this.smokeTimer = 0;
      this.nearMissAwarded = false;
      this.nearMissPending = false;
      this.isDead = false;
      this.ribbonColor = pattern === 'loop' ? 'rgba(255, 60, 180,' : 'rgba(0, 220, 255,';
    }

    applyLevelSpeedScale() {
      const diffScale = getLevelSpeedScale();
      this.airspeed = this.baseAirspeed * diffScale;
    }

    explode() {
      if (this.isDead) return;
      this.isDead = true;
      createExplosion(this.x, this.y, 45);
      createBiplaneDebris(this.x, this.y, this.vx, this.vy, 'stunt', 1.4);
    }

    update(dt) {
      if (this.isDead) return;
      const diffScale = getLevelSpeedScale();
      this.timer += (1.25 * diffScale) * dt;

      if (this.pattern === 'loop') {
        // Continuous giant loop-the-loop maneuver
        this.theta += (1.30 * diffScale) * dt;
        this.vx = Math.cos(this.theta) * this.airspeed;
        this.vy = -Math.sin(this.theta) * this.airspeed;
      } else if (this.pattern === 'wave') {
        // Undulating rollercoaster dive & climb
        this.theta = Math.PI + Math.sin(this.timer) * 0.65;
        this.vx = Math.cos(this.theta) * this.airspeed;
        this.vy = -Math.sin(this.theta) * this.airspeed;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Check collision with Country Structures
      for (const s of structures) {
        if (s.checkCollision(this)) {
          this.explode();
          s.ignite();
          state.shake = Math.min(state.shake + 12, 18);
          playSound('crash');
          const names = {
            barn: 'BARN',
            house: 'HOUSE',
            windmill: 'WINDMILL',
            silo_set: 'SILO',
            water_tower: 'WATER TOWER',
            church: 'CHURCH'
          };
          const structName = names[s.type] || 'BUILDING';
          showStatusBanner(`BIPLANE CRASHED INTO ${structName}!`, 2.2, 'danger');
          return;
        }
      }

      if (this.y >= GROUND_Y - 8) {
        this.explode();
        return;
      }

      // Trailing Acrobatic Smoke Ribbons
      this.smokeTimer += dt;
      if (this.smokeTimer > 0.04) {
        this.smokeTimer = 0;
        createSmokePuff(this.x, this.y, -this.vx * 0.3, -this.vy * 0.3, 3.2, this.ribbonColor);
      }
    }

    checkCollision(plane) {
      if (this.isDead || plane.isDead || (plane.invulnerableTimer && plane.invulnerableTimer > 0)) return false;
      return Math.hypot(plane.x - this.x, plane.y - this.y) < 26;
    }

    draw(ctx, camX) {
      if (this.isDead) return;
      const renderX = this.x - camX;

      ctx.save();
      ctx.translate(renderX, this.y);
      ctx.rotate(-this.theta);

      // Yellow & Black Checker Stunt Sprite
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(-14, -3, 26, 6);
      ctx.fillStyle = '#111111';
      ctx.fillRect(-6, -3, 6, 6); // Checker center
      ctx.fillRect(8, -3, 4, 6);  // Cowl ring

      // Wings
      ctx.fillStyle = '#9b5de5';
      ctx.fillRect(-6, -11, 16, 3);
      ctx.fillRect(-6, 8, 16, 3);

      // Tail
      ctx.fillStyle = '#111111';
      ctx.fillRect(-16, -7, 4, 7);

      ctx.restore();
    }
  }

  // --- BIRD FLOCK PARTICLES & OBSTACLES ---
  class BirdFlock {
    constructor(x, y, count = 5) {
      const diffScale = getLevelSpeedScale();
      this.x = x;
      this.y = y;
      this.count = count;
      this.baseSpeed = 45 + Math.random() * 20;
      this.speed = this.baseSpeed * diffScale;
      this.vx = -this.speed;
      this.nearMissAwarded = false;
      this.nearMissPending = false;
      this.birds = [];
      for (let i = 0; i < count; i++) {
        this.birds.push({
          relX: -i * 14 - (i % 2) * 6,
          relY: (i % 2 === 0 ? 1 : -1) * (i * 8),
          flapTimer: Math.random() * Math.PI * 2
        });
      }
    }

    applyLevelSpeedScale() {
      const diffScale = getLevelSpeedScale();
      this.speed = this.baseSpeed * diffScale;
      this.vx = -this.speed;
    }

    update(dt) {
      const diffScale = getLevelSpeedScale();
      this.x += this.vx * dt;
      for (const b of this.birds) {
        b.flapTimer += (8.0 * diffScale) * dt;
      }
    }

    checkCollision(plane) {
      if (plane.isDead || (plane.invulnerableTimer && plane.invulnerableTimer > 0)) return false;
      for (const b of this.birds) {
        const bx = this.x + b.relX;
        const by = this.y + b.relY;
        if (Math.hypot(plane.x - bx, plane.y - by) < 18) {
          return true;
        }
      }
      return false;
    }

    draw(ctx, camX) {
      for (const b of this.birds) {
        const rx = this.x + b.relX - camX;
        const ry = this.y + b.relY;
        const wingFlap = Math.sin(b.flapTimer);

        ctx.save();
        ctx.strokeStyle = '#2d3436';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        // V-wing flapping silhouette
        const wingTipY = ry - wingFlap * 5;
        ctx.moveTo(rx - 6, wingTipY);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx + 6, wingTipY);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // --- POWER-UP ENTITY (SPEED BOOST & MACHINE GUN) ---
  class PowerUp {
    constructor(x, y, type = 'speed') {
      this.x = x;
      this.y = y;
      this.baseY = y;
      this.type = type; // 'speed', 'gun'
      this.id = `${Math.round(x)}_${Math.round(y)}_${type}`;
      this.radius = 16;
      this.bobOffset = Math.random() * Math.PI * 2;
      this.bobSpeed = 2.5 + Math.random() * 0.5;
      this.pulseTimer = Math.random() * Math.PI * 2;
      this.collected = false;
    }

    update(dt) {
      if (this.collected) return;
      const diffScale = getLevelSpeedScale();
      this.bobOffset += (this.bobSpeed * diffScale) * dt;
      this.pulseTimer += (4.0 * diffScale) * dt;
      // Bouncing in place
      this.y = this.baseY + Math.sin(this.bobOffset) * 8;
    }

    collect(plane) {
      if (this.collected) return;
      this.collected = true;
      collectedPowerUpKeys.add(this.id);

      createConfettiBurst(this.x, this.y, 28, true);

      if (this.type === 'speed') {
        plane.activateSpeedBoost(8.0);
        playSound('powerup_speed');
        addFloatingText(this.x, this.y - 15, '⚡ SPEED BOOST +33%!', '#00e5ff', 11);
        showStatusBanner('⚡ SPEED BOOST ACTIVATED! (+33% SPEED) ⚡', 2.8, 'bonus');
      } else if (this.type === 'gun') {
        plane.activateGun(10.0, 80);
        playSound('powerup_gun');
        addFloatingText(this.x, this.y - 15, '💥 MACHINE GUN BARRAGE!', '#ff4500', 11);
        showStatusBanner('💥 MACHINE GUN STREAM ACTIVATED! 💥', 2.8, 'bonus');
      }

      updateHUD();
    }

    draw(ctx, camX) {
      if (this.collected) return;
      const renderX = this.x - camX;
      const pulse = Math.sin(this.pulseTimer);

      ctx.save();
      ctx.translate(renderX, this.y);

      // 0. Soft ground shadow / halo glow
      const glowColor = this.type === 'speed' ? 'rgba(0, 229, 255,' : 'rgba(255, 69, 0,';
      const auraRadius = this.radius + 4 + pulse * 3;

      ctx.strokeStyle = `${glowColor}${0.35 + pulse * 0.2})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 1. Badge Base (Shield / Medal)
      ctx.fillStyle = this.type === 'speed' ? '#0d2838' : '#380d0d';
      ctx.strokeStyle = this.type === 'speed' ? '#00e5ff' : '#ff4500';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner golden / accent rim
      ctx.strokeStyle = this.type === 'speed' ? '#ffd700' : '#ffa500';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius - 3, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Icon Graphic
      if (this.type === 'speed') {
        // Lightning bolt ⚡
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(1, -9);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-3, 9);
        ctx.lineTo(6, -1);
        ctx.lineTo(1, -1);
        ctx.closePath();
        ctx.fill();

        // Speed chevrons
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, -3);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-10, 3);
        ctx.moveTo(7, -3);
        ctx.lineTo(10, 0);
        ctx.lineTo(7, 3);
        ctx.stroke();
      } else {
        // Machine Gun / Crosshair & 3 Golden Bullets
        ctx.fillStyle = '#ffd700';
        // Center bullet
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-1.5, -8, 3, 2);
        // Left bullet
        ctx.fillRect(-7, -4, 3, 9);
        ctx.fillRect(-6.5, -5.5, 2, 1.5);
        // Right bullet
        ctx.fillRect(4, -4, 3, 9);
        ctx.fillRect(4.5, -5.5, 2, 1.5);

        // Crosshair ring ticks
        ctx.strokeStyle = '#ff4500';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius + 1);
        ctx.lineTo(0, -this.radius + 4);
        ctx.moveTo(0, this.radius - 1);
        ctx.lineTo(0, this.radius - 4);
        ctx.moveTo(-this.radius + 1, 0);
        ctx.lineTo(-this.radius + 4, 0);
        ctx.moveTo(this.radius - 1, 0);
        ctx.lineTo(this.radius - 4, 0);
        ctx.stroke();
      }

      // 3. Floating Mini Label Banner
      ctx.fillStyle = this.type === 'speed' ? '#00e5ff' : '#ff4500';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.type === 'speed' ? 'SPEED' : 'GUN', 0, this.radius + 6);

      ctx.restore();
    }
  }

  // --- BULLET PROJECTILE ENTITY ---
  class Bullet {
    constructor(x, y, vx, vy, theta) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.theta = theta;
      this.life = 0.95; // ~800px range
      this.maxLife = 0.95;
      this.isDead = false;
      this.length = 16;
    }

    update(dt) {
      if (this.isDead) return;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;

      if (this.life <= 0 || this.y >= GROUND_Y) {
        this.isDead = true;
        if (this.y >= GROUND_Y) {
          createSmokePuff(this.x, GROUND_Y - 2, 0, -5, 2.0, 'rgba(200,190,160,');
        }
        return;
      }

      // 1. Collide with Balloons
      for (const b of balloons) {
        if (!b.popped) {
          if (Math.hypot(this.x - b.x, this.y - b.y) < b.radius + 6) {
            b.pop();
            this.isDead = true;
            createConfettiBurst(this.x, this.y, 10);
            return;
          }
        }
      }

      // 2. Collide with Airliners
      for (const al of airliners) {
        if (!al.isDead && !al.isCrashing) {
          const dx = Math.abs(this.x - al.x);
          const dy = Math.abs(this.y - al.y);
          if (dx < al.width / 2 && dy < al.height / 2 + 6) {
            al.triggerCrash(this.x, this.y);
            this.isDead = true;
            addScore(500);
            addFloatingText(this.x, this.y - 16, '+500 AIRLINER SHOT DOWN!', '#ff4500', 11);
            showStatusBanner('🎯 AIRLINER SHOT DOWN! +500 PTS 🎯', 2.2, 'bonus');
            playSound('big_crash');
            createExplosion(this.x, this.y, 25);
            state.shake = Math.min(state.shake + 8, 14);
            return;
          }
        }
      }

      // 3. Collide with Stunt Biplanes
      for (const sp of stuntPlanes) {
        if (!sp.isDead) {
          if (Math.hypot(this.x - sp.x, this.y - sp.y) < 22) {
            sp.explode();
            this.isDead = true;
            addScore(300);
            addFloatingText(this.x, this.y - 16, '+300 BIPLANE SHOT DOWN!', '#ffaa00', 11);
            showStatusBanner('🎯 BIPLANE SHOT DOWN! +300 PTS 🎯', 2.2, 'bonus');
            playSound('crash');
            state.shake = Math.min(state.shake + 6, 12);
            return;
          }
        }
      }

      // 4. Collide with Bird Flocks
      for (const bf of birdFlocks) {
        if (!bf.isDead) {
          for (let i = bf.birds.length - 1; i >= 0; i--) {
            const bird = bf.birds[i];
            const bx = bf.x + bird.relX;
            const by = bf.y + bird.relY;
            if (Math.hypot(this.x - bx, this.y - by) < 16) {
              bf.birds.splice(i, 1);
              createFeatherBurst(bx, by, 20);
              playSound('bird_strike');
              addScore(100);
              addFloatingText(bx, by - 12, '+100 BIRD HIT!', '#55ff77', 10);
              this.isDead = true;
              if (bf.birds.length === 0) {
                bf.isDead = true;
              }
              return;
            }
          }
        }
      }

      // 5. Collide with Country Structures
      for (const s of structures) {
        if (s.checkCollision(this)) {
          this.isDead = true;
          playSound('bullet_ricochet');
          for (let i = 0; i < 4; i++) {
            createFirePuff(this.x, this.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 2.0);
          }
          return;
        }
      }
    }

    draw(ctx, camX) {
      if (this.isDead) return;
      const renderX = this.x - camX;
      const tailX = renderX - Math.cos(this.theta) * this.length;
      const tailY = this.y + Math.sin(this.theta) * this.length;

      ctx.save();

      // Outer tracer glow
      ctx.strokeStyle = 'rgba(255, 120, 0, 0.5)';
      ctx.lineWidth = 4.0;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(renderX, this.y);
      ctx.stroke();

      // Bright core tracer
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(renderX, this.y);
      ctx.stroke();

      // White-hot tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(renderX, this.y, 2.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // --- PLAYER PLANE & FLIGHT DYNAMICS ---
  class PlayerPlane {
    constructor(x, y) {
      this.x = x;
      this.y = y;

      // Flight Vector & Orientation (0 = right, PI = left)
      this.theta = 0;
      this.speedBoostTimer = 0;
      this.isSpeedBoosted = false;
      this.gunTimer = 0;
      this.gunAmmo = 0;
      this.fireCooldown = 0;
      this.fireFlashTimer = 0;

      this.initAeroStats();
      this.airspeed = this.cruiseSpeed;
      this.vx = this.cruiseSpeed;
      this.vy = 0;

      // Flight State
      this.stalled = false;
      this.stallTime = 0;
      this.baseFacing = 1; // 1 = East (Right), -1 = West (Left)
      this.invertedTimer = 0;
      this.rollTimer = 0;
      this.rollDuration = 0.38;
      this.onGround = false;
      this.isStopped = false;
      this.isBraking = false;
      this.isIdle = false; // false = Max throttle (full power), true = Idle
      this.lastSpaceState = false;
      this.fuel = 100;
      this.maxFuel = 100;
      this.boostTimer = 0;
      this.propAngle = 0;
      this.invulnerableTimer = 2.5; // Safe spawn grace period
      this.canGroundNearMiss = false; // Armed once plane climbs to safe altitude
      this.groundNearMissPending = false;

      // Runway service, refueling & takeoff roll states
      this.stopTimer = 0;
      this.isParkedForService = false;
      this.throttleUp = false;
      this.rpm = 0.2;
      this.takeoffTimer = 0;

      // Visuals & Damage States
      this.width = 34;
      this.height = 18;
      this.smokeTimer = 0;
      this.isDead = false;
      this.handledDeath = false;

      // Bird strike damage & wobbly crash state
      this.isWobblingCrash = false;
      this.wobbleTimer = 0;
      this.wobblePhase = 0;
      this.sputterSoundTimer = 0;
      this.engineFailed = false;
      this.missingTail = false;
    }

    initAeroStats() {
      const diffScale = getLevelSpeedScale();
      const boostMult = this.isSpeedBoosted ? 1.33 : 1.0;
      // Aerodynamics & Energy Speeds (Boosted +20% base, scaled +5% per level, +33% during powerup)
      this.cruiseSpeed = 168 * diffScale * boostMult;   // Base unboosted level flight speed (+20% from 140) * diffScale
      this.maxLevelSpeed = 234 * diffScale * boostMult; // Max level flight speed achievable under boost * diffScale
      this.maxDiveSpeed = 396 * diffScale * boostMult;  // Terminal dive velocity achievable in power dive * diffScale
      this.maxSpeed = 396 * diffScale * boostMult;      // Hard speed ceiling * diffScale
      this.stallSpeed = 52 * diffScale;
      this.recoverSpeed = 82 * diffScale;
      this.minSpeed = 20 * diffScale;
      this.pitchRate = 2.85 * diffScale;
    }

    applyLevelSpeedScale() {
      const prevCruise = this.cruiseSpeed || 168;
      this.initAeroStats();
      const ratio = this.cruiseSpeed / prevCruise;
      if (!this.onGround && !this.isWobblingCrash) {
        this.airspeed = Math.max(this.minSpeed, this.airspeed * ratio);
        this.vx *= ratio;
        this.vy *= ratio;
      }
    }

    activateSpeedBoost(duration = 8.0) {
      this.speedBoostTimer = Math.max(this.speedBoostTimer, duration);
      this.isSpeedBoosted = true;
      this.initAeroStats();

      // If current speed is less than normal max cruise speed, boost as if already at max level cruise speed
      const diffScale = getLevelSpeedScale();
      const normalCruiseSpeed = 168 * diffScale;
      const baseSpeed = Math.max(this.airspeed, normalCruiseSpeed);
      const newAirspeed = Math.min(baseSpeed * 1.33, this.maxSpeed);

      if (this.airspeed > 0.001) {
        const ratio = newAirspeed / this.airspeed;
        this.vx *= ratio;
        this.vy *= ratio;
      } else {
        const noseX = Math.cos(this.theta);
        const noseY = -Math.sin(this.theta);
        this.vx = noseX * newAirspeed;
        this.vy = noseY * newAirspeed;
      }
      this.airspeed = newAirspeed;

      this.isIdle = false; // Engage active throttle
      if (this.stalled) {
        this.stalled = false;
      }
      if (this.onGround) {
        this.throttleUp = true;
        this.isStopped = false;
        this.isBraking = false;
      }
    }

    activateGun(duration = 12.0, ammo = 45) {
      this.gunTimer = Math.max(this.gunTimer, duration);
      this.gunAmmo = Math.max(this.gunAmmo, ammo);
    }

    shoot() {
      if (this.isDead || (this.gunTimer <= 0 && this.gunAmmo <= 0)) return;
      if (this.fireCooldown > 0) return;

      this.fireCooldown = 0.11; // ~9 rounds per second continuous tracer stream
      if (this.gunAmmo > 0) {
        this.gunAmmo--;
      }
      this.fireFlashTimer = 0.06;

      const noseX = Math.cos(this.theta);
      const noseY = -Math.sin(this.theta);
      const muzzleX = this.x + noseX * 22;
      const muzzleY = this.y + noseY * 22;

      const bulletSpeed = 900;
      const bVx = noseX * bulletSpeed + this.vx * 0.4;
      const bVy = noseY * bulletSpeed + this.vy * 0.4;

      bullets.push(new Bullet(muzzleX, muzzleY, bVx, bVy, this.theta));
      playSound('machine_gun');

      // Muzzle flash particle & smoke
      createSmokePuff(muzzleX, muzzleY, this.vx * 0.1, this.vy * 0.1, 2.0, 'rgba(255,220,100,');
    }

    get flightAngle() {
      const wSpeed = settings.wind ? wind.speed : 0;
      return Math.atan2(-this.vy, this.vx - wSpeed);
    }

    get angleOfAttack() {
      let diff = this.theta - this.flightAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return diff;
    }

    triggerBirdStrike() {
      if (this.isDead || (this.invulnerableTimer && this.invulnerableTimer > 0) || this.isWobblingCrash) return;

      this.groundNearMissPending = false;
      this.isWobblingCrash = true;
      this.wobbleTimer = 0;
      this.wobblePhase = 0;
      this.missingTail = true;
      this.engineFailed = true;
      this.fuel = 0;
      this.airspeed = Math.min(this.airspeed, 110 * getLevelSpeedScale());

      playSound('bird_strike');
      playSound('wing_tear');
      playSound('engine_sputter');

      createFeatherBurst(this.x, this.y, 28);
      state.shake = Math.min(state.shake + 12, 16);

      // Tail piece flies off
      createDebrisPiece({
        x: this.x - 14,
        y: this.y - 4,
        vx: this.vx * 0.3 - (Math.random() * 70 + 40),
        vy: -Math.random() * 60 - 30,
        width: 8,
        height: 10,
        color: '#2b7a78',
        accentColor: '#def2f1',
        type: 'tail',
        smoking: true,
        rotSpeed: (Math.random() - 0.5) * 12
      });

      showStatusBanner('COLLIDED WITH BIRDS!', 2.5, 'warning');
    }

    breakApart(cause = 'general') {
      if (this.isDead || (this.invulnerableTimer && this.invulnerableTimer > 0)) return;
      this.groundNearMissPending = false;
      this.isDead = true;
      createExplosion(this.x, this.y, 50);
      createBiplaneDebris(this.x, this.y, this.vx, this.vy, 'player', cause === 'stunt' ? 1.5 : 1.7);
    }

    crash() {
      if (this.isDead || (this.invulnerableTimer && this.invulnerableTimer > 0)) return;
      this.groundNearMissPending = false;
      this.isDead = true;
      createExplosion(this.x, this.y, 45);
      createBiplaneDebris(this.x, this.y, this.vx, this.vy, 'player', 1.1);
    }

    update(dt, input) {
      if (this.isDead) return;

      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer -= dt;
      }

      const diffScale = getLevelSpeedScale();
      const wSpeed = settings.wind ? wind.speed : 0;

      // Edge-triggered spacebar press detection
      const spacePressed = (input.space || input.boost);
      const spaceJustPressed = spacePressed && !this.lastSpaceState;
      this.lastSpaceState = !!spacePressed;

      // Special Handling for Bird-Strike Wobbly Descent
      if (this.isWobblingCrash) {
        this.wobbleTimer += dt;
        this.wobblePhase += 11.0 * dt;

        // Propeller sputters down to stop
        this.propAngle += Math.max(0, 18 - this.wobbleTimer * 6) * dt;

        // Sputter sound effect intermittently
        this.sputterSoundTimer += dt;
        if (this.sputterSoundTimer > 0.35 && this.wobbleTimer < 2.0) {
          this.sputterSoundTimer = 0;
          if (Math.random() < 0.5) playSound('engine_sputter');
        }

        // Aerodynamic tail-loss pitch instability: oscillating nose wobble + increasing downward pitch
        const wobbleAmp = Math.min(1.2, 0.4 + this.wobbleTimer * 0.4);
        this.theta += Math.sin(this.wobblePhase) * 4.8 * dt * wobbleAmp - 0.65 * dt;

        while (this.theta > Math.PI) this.theta -= Math.PI * 2;
        while (this.theta < -Math.PI) this.theta += Math.PI * 2;

        // Ballistic fall with gravity and drag (exponential damping towards ambient air)
        this.vy += (135 * diffScale) * dt;
        const relVx = this.vx - wSpeed;
        this.vx = wSpeed + relVx * Math.exp(-0.18 * dt);
        this.airspeed = Math.hypot(this.vx - wSpeed, this.vy);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Smoke and coughing fire sparks
        this.smokeTimer += dt;
        if (this.smokeTimer > 0.035) {
          this.smokeTimer = 0;
          const noseX = Math.cos(this.theta);
          const noseY = -Math.sin(this.theta);

          // Dark engine smoke from nose
          createSmokePuff(
            this.x + noseX * 14,
            this.y + noseY * 14,
            -this.vx * 0.15,
            -this.vy * 0.15,
            4.2,
            'rgba(50,50,50,'
          );

          // Damaged tail stump smoke
          createSmokePuff(
            this.x - noseX * 16,
            this.y - noseY * 16,
            -this.vx * 0.2,
            -this.vy * 0.2,
            3.5,
            'rgba(80,80,80,'
          );

          if (Math.random() < 0.35) {
            createFirePuff(this.x + noseX * 12, this.y + noseY * 12, -this.vx * 0.1, -this.vy * 0.1, 3.5);
          }
        }

        // Impact with ground
        if (this.y >= GROUND_Y - 8) {
          this.crash();
          showStatusBanner('COLLIDED WITH GROUND!', 2.0);
          return;
        }
        return;
      }

      if (this.isParkedForService || this.isStopped) {
        const spinRate = this.throttleUp ? (120 + this.rpm * 350) : 45;
        this.propAngle += spinRate * dt * 0.2;
      } else if (this.throttleUp && this.onGround) {
        const spinRate = 120 + this.rpm * 350;
        this.propAngle += spinRate * dt * 0.2;
      } else if (this.isIdle && !this.onGround) {
        this.propAngle += 35 * dt * 0.2;
      } else {
        this.propAngle += (this.airspeed + 60) * dt * 0.2;
      }

      // 1. Ground & Landing Mechanics
      const groundContactY = GROUND_Y - 8;
      if (this.y >= groundContactY) {
        this.y = groundContactY;

        const pitchSin = Math.abs(Math.sin(this.theta));
        const gentleDescent = this.vy <= (75 * diffScale);
        const levelAttitude = pitchSin < 0.38;

        if (levelAttitude && gentleDescent) {
          const justLanded = !this.onGround;
          this.onGround = true;
          this.groundNearMissPending = false;
          this.vy = 0;
          this.stalled = false;
          this.invertedTimer = 0;
          this.theta = 0;
          this.baseFacing = 1;

          if (justLanded) {
            this.isStopped = false;
            this.throttleUp = false;
            this.isBraking = false;
            this.isIdle = false;
            this.takeoffTimer = 0;
            this.stopTimer = 0;
            showStatusBanner('TOUCHDOWN! HOLD SPACE TO BRAKE', 1.5, 'info');
          }

          const currentRunway = getRunwayAtPoint(this.x);

          // State A: Plane is stopped on ground / runway
          if (this.isStopped) {
            // Refueling while stopped (4-second full refill)
            if (this.fuel < this.maxFuel) {
              this.fuel = Math.min(this.maxFuel, this.fuel + (this.maxFuel / 4.0) * dt);
            }

            // After being stopped, space applies full throttle!
            if (spaceJustPressed || spacePressed) {
              this.throttleUp = true;
              this.isStopped = false;
              this.isIdle = false;
              this.takeoffTimer = 0;
            }

            if (!this.throttleUp) {
              this.vx = 0;
              this.airspeed = Math.abs(wSpeed); // Ground airspeed reading from wind
              this.rpm = 0.2;
              if (this.fuel < this.maxFuel) {
                const fuelPct = Math.round((this.fuel / this.maxFuel) * 100);
                showStatusBanner(`REFUELING: ${fuelPct}%... PRESS SPACE FOR FULL THROTTLE`, 0.2, 'info');
              } else {
                showStatusBanner('STOPPED & READY! PRESS SPACE FOR FULL THROTTLE & TAKEOFF', 0.2, 'success');
              }
              return;
            }
          }

          // State B: Full throttle acceleration on ground towards takeoff
          if (this.throttleUp) {
            // Engine spools up rapidly to max RPM (max level flight sound)
            this.rpm = Math.min(1.0, this.rpm + 2.0 * dt);

            // Accelerate ground speed up to max ground speed
            const maxGroundSpeed = this.cruiseSpeed * 0.75;
            const groundAccel = 110 * diffScale;
            this.vx = Math.min(maxGroundSpeed, (this.vx || 0) + groundAccel * dt);
            this.airspeed = Math.max(0, this.vx - wSpeed);
            this.x += this.vx * dt;

            showStatusBanner(`FULL THROTTLE! AIRSPEED: ${Math.round(this.airspeed)} - PULL UP TO CLIMB`, 0.2, 'info');

            // Liftoff when reaching wing airspeed >= 70 * diffScale
            if (this.airspeed >= (70 * diffScale) && (input.pitchUp || this.vx >= maxGroundSpeed)) {
              this.onGround = false;
              this.isParkedForService = false;
              this.throttleUp = false;
              this.isStopped = false;
              this.isBraking = false;
              this.isIdle = false;
              this.takeoffTimer = 1.0;
              this.vy = -32 * diffScale;
              this.y -= 6;
              showStatusBanner('AIRBORNE! MAX THROTTLE', 2.0, 'success');
            }
            return;
          }

          // State C: Landing roll (transitioned from airborne to ground, moving forward before stopping)
          // Space bar applies brakes!
          if (spacePressed) {
            this.isBraking = true;
            // Strong brake deceleration
            this.vx = Math.max(0, this.vx - (130 * diffScale) * dt);
            if (Math.random() < 0.35 && this.vx > 15) {
              createSmokePuff(this.x - 8, groundContactY + 6, -this.vx * 0.2, -10, 2.5, 'rgba(210,210,210,');
            }
            this.airspeed = Math.max(0, this.vx - wSpeed);
            showStatusBanner(`BRAKING... AIRSPEED: ${Math.round(this.airspeed)}`, 0.2, 'info');
          } else {
            this.isBraking = false;
            // Gentle rolling friction deceleration
            const rollFriction = (currentRunway ? 50 : 40) * diffScale;
            this.vx = Math.max(0, this.vx - rollFriction * dt);
            this.airspeed = Math.max(0, this.vx - wSpeed);
            showStatusBanner('LANDED. HOLD SPACE TO BRAKE', 0.2, 'info');
          }

          this.x += this.vx * dt;

          // Check if speed has reached zero / stopped
          if (this.vx <= 2.0) {
            this.vx = 0;
            this.airspeed = Math.abs(wSpeed);
            this.isBraking = false;
            this.isStopped = true;
            this.throttleUp = false;
            this.stopTimer = 0;

            if (currentRunway) {
              this.isParkedForService = true;
            }
            showStatusBanner('STOPPED! PRESS SPACE FOR FULL THROTTLE', 1.5, 'success');
          }
          return;
        } else {
          // Hard landing crash (only if not in spawn invulnerability)
          if (this.invulnerableTimer <= 0) {
            this.crash();
            showStatusBanner('COLLIDED WITH GROUND!', 2.0, 'danger');
            return;
          }
        }
      } else {
        this.onGround = false;
        this.isParkedForService = false;
        this.throttleUp = false;
        this.isStopped = false;
        this.isBraking = false;
        this.stopTimer = 0;
      }

      // Arm ground near miss when flying safely above low altitude
      if (this.y < GROUND_Y - 55 && !this.onGround) {
        this.canGroundNearMiss = true;
      }

      // Decay takeoffTimer when airborne to smoothly settle into normal flight acoustics
      if (this.takeoffTimer > 0) {
        this.takeoffTimer = Math.max(0, this.takeoffTimer - 0.7 * dt);
      }

      // 2. Inverted Flight Auto-Roll (Disabled for intuitive left-to-right flight)
      this.invertedTimer = 0;
      this.rollTimer = 0;

      // Speed Boost Timer & State
      if (this.speedBoostTimer > 0) {
        this.speedBoostTimer -= dt;
        if (!this.isSpeedBoosted) {
          this.isSpeedBoosted = true;
          this.initAeroStats();
        }
      } else if (this.isSpeedBoosted) {
        this.isSpeedBoosted = false;
        this.initAeroStats();
      }

      // Gun Timer, Cooldown & Continuous Auto-Stream Firing
      if (this.fireCooldown > 0) this.fireCooldown -= dt;
      if (this.fireFlashTimer > 0) this.fireFlashTimer -= dt;
      if (this.gunTimer > 0) {
        this.gunTimer -= dt;
        if (this.gunTimer <= 0) {
          this.gunAmmo = 0;
        }
      }

      // Automatically fire stream of bullets while gun is active, and also on manual trigger
      const isGunActive = (this.gunTimer > 0 || this.gunAmmo > 0) && !this.isDead;
      if (isGunActive || (input.fire && !this.isDead)) {
        this.shoot();
      }

      // 3. Airborne Engine Throttle Toggle (Space bar toggles Max Throttle / Idle)
      if (spaceJustPressed) {
        this.isIdle = !this.isIdle;
        showStatusBanner(this.isIdle ? 'THROTTLE: IDLE (GLIDING)' : 'THROTTLE: MAX (FULL POWER)', 1.5, 'info');
      }

      // Fuel consumption (idle consumes less fuel)
      const fuelBurnRate = this.isIdle ? 0.15 : 0.7;
      this.fuel = Math.max(0, this.fuel - fuelBurnRate * dt);
      this.boostTimer = 0;
      const hasThrust = this.fuel > 0;

      // 4. Pitch Controls
      let pitchAuthority = this.stalled ? 0.35 : Math.min(1.25, Math.max(0.5, this.airspeed / this.cruiseSpeed));
      const pitchDir = 1;

      if (input.pitchUp) {
        this.theta += pitchDir * this.pitchRate * pitchAuthority * dt;
      }
      if (input.pitchDown) {
        this.theta -= pitchDir * this.pitchRate * pitchAuthority * dt;
      }

      while (this.theta > Math.PI) this.theta -= Math.PI * 2;
      while (this.theta < -Math.PI) this.theta += Math.PI * 2;

      // 5. Energy Management & Aerodynamics
      const pitchSin = Math.sin(this.theta);
      const noseX = Math.cos(this.theta);
      const noseY = -pitchSin;

      // Supersonic flame exhaust trail from engine / tail when speed boosted
      if (this.isSpeedBoosted && !this.onGround && Math.random() < 0.75) {
        const tailX = this.x - noseX * 18;
        const tailY = this.y - noseY * 18;
        createFirePuff(tailX, tailY, -this.vx * 0.2, -this.vy * 0.2, 3.2);
        createSmokePuff(tailX, tailY, -this.vx * 0.15, -this.vy * 0.15, 2.5, 'rgba(0,229,255,');
      }

      if (!this.stalled) {
        // Angle of Attack (AoA): angle between aircraft nose and true relative air velocity vector
        const aoa = Math.abs(this.angleOfAttack);

        // Critical AoA threshold (~37.2 degrees): tolerant to digital keyboard full-stick inputs
        const criticalAoA = 0.65;
        const isExceedingAoA = aoa >= criticalAoA;

        // Progressive AoA induced drag: increases quadratically as AoA approaches critical limit
        const aoaRatio = Math.min(1.5, aoa / criticalAoA);
        const aoaDrag = Math.pow(aoaRatio, 2) * (45 * diffScale);

        // Gravitational acceleration / deceleration:
        // Dives accelerate powerfully (+330), while climbs bleed airspeed at a balanced rate (-205)
        const gravityAccel = (pitchSin < 0 ? (-pitchSin * 330) : (-pitchSin * 205)) * diffScale;

        // Level flight, dive, and climb engine thrust equilibrium:
        let engineThrustDrag = 0;
        if (pitchSin < 0) {
          // In a power dive: engine provides forward pull, without braking against gravity
          const idlePenalty = this.isIdle ? (-45 * diffScale) : 0;
          let highSpeedDrag = 0;
          if (this.airspeed > this.maxLevelSpeed) {
            const excess = (this.airspeed - this.maxLevelSpeed) / (this.maxDiveSpeed - this.maxLevelSpeed);
            highSpeedDrag = Math.pow(Math.max(0, excess), 2) * (240 * diffScale);
          }
          engineThrustDrag = (hasThrust && !this.isIdle ? (40 * diffScale) : 0) + idlePenalty - highSpeedDrag;
        } else {
          // In level flight or climb: engine thrust capability drops with climb steepness
          const climbPenalty = pitchSin * (125 * diffScale);
          const targetLevelSpeed = this.isIdle ? (30 * diffScale) : Math.max(25 * diffScale, this.cruiseSpeed - climbPenalty);
          const thrustResponse = (hasThrust && !this.isIdle) ? (this.airspeed < targetLevelSpeed ? 0.85 : 0.65) : 0.30;
          const enginePenalty = (!hasThrust || this.isIdle) ? (-35 * diffScale) : 0;
          let highSpeedDrag = 0;
          if (this.airspeed > this.maxLevelSpeed) {
            const excess = (this.airspeed - this.maxLevelSpeed) / (this.maxDiveSpeed - this.maxLevelSpeed);
            highSpeedDrag = Math.pow(Math.max(0, excess), 2) * (200 * diffScale);
          }
          engineThrustDrag = (targetLevelSpeed - this.airspeed) * thrustResponse + enginePenalty - highSpeedDrag;
        }

        const dAirspeed = (gravityAccel + engineThrustDrag - aoaDrag) * dt;
        this.airspeed = Math.max(this.minSpeed, Math.min(this.maxDiveSpeed, this.airspeed + dAirspeed));

        // Aerodynamic forces project relative to the ambient air mass:
        const targetAirVx = noseX * this.airspeed;
        const targetAirVy = noseY * this.airspeed;

        // Ground velocity target = air velocity + horizontal wind
        const targetGroundVx = targetAirVx + wSpeed;
        const targetGroundVy = targetAirVy;

        // Aerodynamic velocity inertia: tuned for clean digital keyboard controls
        const responsiveness = 1 - Math.exp(-9.0 * dt);
        this.vx += (targetGroundVx - this.vx) * responsiveness;
        this.vy += (targetGroundVy - this.vy) * responsiveness;

        // Recompute true airspeed relative to air mass
        this.airspeed = Math.hypot(this.vx - wSpeed, this.vy);

        // Stall conditions:
        // 1. Low airspeed stall (airspeed < stallSpeed)
        // 2. Critical AoA stall (AoA >= criticalAoA ~37.2°)
        if (this.airspeed < this.stallSpeed || isExceedingAoA) {
          this.stalled = true;
        }

      } else {
        // Stalled ballistic fall with frame-rate independent drag & orientation alignment
        this.stallTime = (this.stallTime || 0) + dt;
        this.vy += (135 * diffScale) * dt;

        // Air drag damps relative horizontal air velocity toward 0 (drifting with wind)
        const relAirVx = this.vx - wSpeed;
        this.vx = wSpeed + relAirVx * Math.exp(-0.25 * dt);
        this.airspeed = Math.hypot(this.vx - wSpeed, this.vy);

        const fallAngle = this.flightAngle;
        let angleDiff = fallAngle - this.theta;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.theta += angleDiff * (1 - Math.exp(-2.2 * dt));

        // Stall recovery: point nose down with relative velocity vector and build airspeed past recoverSpeed
        const aoa = Math.abs(this.angleOfAttack);
        if (aoa < 0.40 && this.airspeed > this.recoverSpeed) {
          this.stalled = false;
          if (this.stallTime > 0.8) {
            addScore(150);
            addFloatingText(this.x, this.y - 14, '+150 STALL RECOVER!', '#55ff77', 10);
            showStatusBanner('★ STALL RECOVERED! +150 BONUS ★', 1.8, 'bonus');
          }
          this.stallTime = 0;
        }
      }

      // 6. Position Integration
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Sky ceiling (max altitude limit)
      if (this.y <= 18) {
        this.y = 18;
        if (this.vy < 0) this.vy = 0;
        // Pushing nose up against the ceiling bleeds airspeed and triggers a stall
        if (pitchSin > 0.20) {
          this.airspeed = Math.max(this.minSpeed, this.airspeed - (135 * diffScale) * dt);
          if (this.airspeed < this.stallSpeed || Math.abs(this.angleOfAttack) > 0.45) {
            this.stalled = true;
          }
        }
      }

      // 7. Smoke trails on stall
      this.smokeTimer += dt;
      if (this.stalled) {
        if (this.smokeTimer > 0.05) {
          this.smokeTimer = 0;
          createSmokePuff(
            this.x - noseX * 14, 
            this.y - noseY * 14, 
            -this.vx, 
            -this.vy, 
            3.5,
            'rgba(180,180,180,'
          );
        }
      }
    }

    draw(ctx, camX) {
      if (this.isDead) return;
      const renderX = this.x - camX;

      ctx.save();
      ctx.translate(renderX, this.y);

      // Blinking effect during spawn invulnerability grace period
      if (this.invulnerableTimer > 0) {
        if (Math.floor(this.invulnerableTimer * 10) % 2 === 0) {
          ctx.globalAlpha = 0.45;
        }
      }

      ctx.rotate(-this.theta);
      this.drawBiplaneSprite(ctx, false);

      ctx.restore();
    }

    drawBiplaneSprite(ctx, facingWest) {
      if (facingWest) {
        ctx.scale(-1, 1);
      }

      // Vibrant Fly By Sky Blue & Crimson Aero Paint
      const primaryColor = '#2b7a78';
      const wingColor = '#3aafa9';
      const accentColor = '#def2f1';

      // Supersonic Speed Boost Jet Flame (drawn behind tail)
      if (this.isSpeedBoosted && !this.isDead) {
        ctx.save();
        ctx.fillStyle = '#00e5ff';
        const flameLen = 12 + Math.random() * 8;
        ctx.beginPath();
        ctx.moveTo(-18, -3);
        ctx.lineTo(-18 - flameLen, 0);
        ctx.lineTo(-18, 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-18, -1.5);
        ctx.lineTo(-18 - flameLen * 0.5, 0);
        ctx.lineTo(-18, 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 1. Fuselage
      ctx.fillStyle = primaryColor;
      ctx.fillRect(-14, -4, 28, 8);
      ctx.fillRect(-18, -2, 4, 4);
      ctx.fillStyle = '#17252a';
      ctx.fillRect(14, -3, 3, 6);

      // 2. Cockpit & Pilot
      ctx.fillStyle = '#111';
      ctx.fillRect(-2, -6, 6, 3);
      ctx.fillStyle = '#f5cba7';
      ctx.fillRect(0, -8, 4, 4);
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-1, -9, 6, 2); // Leather aviator helmet
      if (this.airspeed > 40 && !this.isWobblingCrash) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, -6, 4, 2); // Flowing white silk scarf!
      }

      // 3. Wings
      ctx.fillStyle = wingColor;
      ctx.fillRect(-10, -11, 22, 4); // Top
      ctx.fillRect(-8, 5, 20, 3);    // Bottom
      ctx.fillStyle = '#2b3a4a';
      ctx.fillRect(2, -7, 2, 12);
      ctx.fillRect(-6, -7, 2, 12);

      // Machine Gun Mounts (Twin Vickers Barrels) if gun active
      if ((this.gunTimer > 0 || this.gunAmmo > 0) && !this.isDead) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(4, -8, 10, 2); // Top right barrel
        ctx.fillRect(4, -5, 10, 2); // Top left barrel
        ctx.fillStyle = '#ff4500';
        ctx.fillRect(12, -8, 2, 2); // Flash hider tip
        ctx.fillRect(12, -5, 2, 2);
      }

      // 4. Tail & Rudder (if not severed)
      if (!this.tailLost) {
        ctx.fillStyle = primaryColor;
        ctx.fillRect(-20, -10, 5, 8);
        ctx.fillStyle = accentColor;
        ctx.fillRect(-21, -8, 2, 5);
      } else {
        // Jagged charred tail stump with embers
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-18, -4, 4, 6);
        ctx.fillStyle = '#ff4500';
        ctx.fillRect(-19, -2, 2, 3);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-18, -1, 1.5, 1.5);
      }

      // 5. Landing Gear
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 8, 2, 4);
      ctx.fillRect(-1, 11, 4, 4);

      // 6. Spinning Propeller
      ctx.save();
      ctx.translate(17, 0);
      ctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
      const propHeight = Math.sin(this.propAngle) * 14;
      ctx.fillRect(-1, -propHeight / 2, 2, propHeight);

      // Muzzle Flash Starburst
      if (this.fireFlashTimer > 0) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(6, -6, 5 + Math.random() * 3, 0, Math.PI * 2);
        ctx.arc(6, 0, 4 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(6, -6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // --- DYNAMIC PROCEDURAL WORLD & CHUNK MANAGER ---
  const CHUNK_SIZE = 1000;
  let player = new PlayerPlane(80, 220);
  let airfields = [];
  let structures = [];
  let balloons = [];
  let powerups = [];
  let bullets = [];
  let airliners = [];
  let stuntPlanes = [];
  let birdFlocks = [];
  let generatedChunks = new Set();
  let poppedBalloonKeys = new Set();
  let collectedPowerUpKeys = new Set();
  let worldSeed = Math.floor(Math.random() * 1000000) + 1;
  let powerupSpawnTimer = 6.0;

  class Airfield {
    constructor(startX, length = 380) {
      this.startX = startX;
      this.length = length;
      this.endX = startX + length;
      this.hangarX = startX - 50;
      this.windsockX = startX - 29; // Positioned on top of hangar (hangarX + 21)
      this.flames = [];
    }

    igniteHangar(mult = 1.0) {
      playSound('fire_ignite');
      this.flames = [];
      for (let i = 0; i < 2; i++) {
        const fx = this.hangarX + 12 + i * 18;
        const dur = (2.0 + Math.random() * 1.0) * mult;
        this.flames.push({
          x: fx,
          width: 30 + Math.random() * 8,
          height: 44 + Math.random() * 10,
          life: dur,
          maxLife: dur,
          phase: Math.random() * 10,
          smokeTimer: Math.random() * 0.1
        });
      }
    }

    update(dt) {
      if (this.flames.length > 0) {
        const currentWind = settings.wind ? wind.speed : 0;
        for (let i = this.flames.length - 1; i >= 0; i--) {
          const f = this.flames[i];
          f.life -= dt;
          f.smokeTimer += dt;
          if (f.smokeTimer >= 0.20) {
            f.smokeTimer = 0;
            const smokeX = f.x + (settings.wind ? (wind.speed * 0.15) : 0);
            createSmokePuff(
              smokeX,
              GROUND_Y - f.height * 0.85,
              currentWind * 0.25,
              -Math.random() * 25 - 15,
              3.5 + Math.random() * 2.0,
              'rgba(90,90,90,'
            );
          }
          if (f.life <= 0) {
            this.flames.splice(i, 1);
          }
        }
      }
    }
  }

  function makePRNG(seed) {
    let s = (seed ^ 0x9e3779b9) >>> 0;
    return function() {
      let t = s += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isPointOnAnyRunway(x, margin = 30) {
    for (const af of airfields) {
      if (x >= af.startX - margin && x <= af.endX + margin) {
        return true;
      }
    }
    return false;
  }

  function getRunwayAtPoint(x, margin = 40) {
    for (const af of airfields) {
      if (x >= af.startX - margin && x <= af.endX + margin) {
        return af;
      }
    }
    return null;
  }

  function isRangeOverlappingRunway(startX, endX, buffer = 80) {
    for (const af of airfields) {
      if (endX >= af.startX - buffer && startX <= af.endX + buffer) {
        return true;
      }
    }
    return false;
  }

  function generateChunk(k) {
    if (generatedChunks.has(k)) return;
    generatedChunks.add(k);

    const rand = makePRNG(worldSeed + k * 7919);
    const chunkStart = k * CHUNK_SIZE;

    // 1. Airfield Placement (Every 2 chunks: ~2000px, e.g. chunk 0, 2, 4, -2, etc.)
    let chunkHasRunway = false;
    if (k === 0) {
      // Initial home spawn airfield
      chunkHasRunway = true;
      airfields.push(new Airfield(RUNWAY_START, RUNWAY_END - RUNWAY_START));
    } else if (Math.abs(k) % 2 === 0) {
      chunkHasRunway = true;
      const rwStart = chunkStart + 120 + rand() * 100;
      const rwLength = 360 + rand() * 80;
      airfields.push(new Airfield(rwStart, rwLength));
    }

    // 2. Countryside Structures & Dives
    const structureTypes = ['barn', 'house', 'windmill', 'silo_set', 'water_tower', 'church'];
    const numStructures = chunkHasRunway ? 1 : 2;

    for (let i = 0; i < numStructures; i++) {
      let sx;
      if (chunkHasRunway) {
        sx = chunkStart + (rand() < 0.5 ? 600 + rand() * 200 : 80 + rand() * 100);
        if (isRangeOverlappingRunway(sx - 20, sx + 130)) {
          sx = chunkStart + 750;
        }
      } else {
        const baseOffset = i === 0 ? 150 : 650;
        sx = chunkStart + baseOffset + (rand() - 0.5) * 160;
      }

      if (isRangeOverlappingRunway(sx - 30, sx + 130)) continue;

      const stype = structureTypes[Math.floor(rand() * structureTypes.length)];
      const struct = new CountryStructure(sx, stype);
      structures.push(struct);

      // Place Low Dive / Roof Balloon
      let diveY = GROUND_Y - struct.height - 18;
      if (stype === 'windmill') diveY = GROUND_Y - 125;
      else if (stype === 'silo_set') diveY = GROUND_Y - 105;
      else if (stype === 'barn') diveY = GROUND_Y - 105;
      else if (stype === 'church') diveY = GROUND_Y - 128;
      else if (stype === 'water_tower') diveY = GROUND_Y - 110;

      const diveType = rand() < 0.4 ? 'gold' : 'rainbow';
      const diveBalloon = new Balloon(sx + struct.width / 2, diveY, diveType);
      if (!poppedBalloonKeys.has(diveBalloon.id)) {
        balloons.push(diveBalloon);
      }

      // For barns, tempt players to fly through by placing a star or rainbow balloon inside the breezeway tunnel!
      if (stype === 'barn' && rand() < 0.65) {
        const tunnelY = (struct.gapTop + struct.gapBottom) / 2;
        const tunnelType = rand() < 0.55 ? 'gold' : 'rainbow';
        const tunnelBalloon = new Balloon(sx + struct.width / 2, tunnelY, tunnelType);
        if (!poppedBalloonKeys.has(tunnelBalloon.id)) {
          balloons.push(tunnelBalloon);
        }
      }
    }

    // 3. Aerial Sine-wave & Slalom Balloon Courses
    for (let x = chunkStart + 40; x < chunkStart + CHUNK_SIZE; x += 110) {
      // Avoid overlap with structure dive balloons
      let nearStructure = false;
      for (const s of structures) {
        if (Math.abs(x - (s.x + s.width / 2)) < 55) {
          nearStructure = true;
          break;
        }
      }
      if (nearStructure) continue;

      // Undulating sine wave altitude
      const waveY = 220 + Math.sin(x * 0.008) * 110;
      const rVal = rand();
      const bType = rVal < 0.5 ? 'red' : rVal < 0.75 ? 'blue' : rVal < 0.9 ? 'green' : 'gold';
      const b = new Balloon(x, waveY, bType);
      if (!poppedBalloonKeys.has(b.id)) {
        balloons.push(b);
      }

      // High altitude climb balloon
      if (Math.abs(x % 330) < 60 && rand() < 0.6) {
        const highB = new Balloon(x, 70 + Math.sin(x * 0.01) * 30, 'gold');
        if (!poppedBalloonKeys.has(highB.id)) {
          balloons.push(highB);
        }
      }
    }

    // 4. Random Bouncing Power-Ups (Speed Boost & Machine Gun)
    if (settings.powerups) {
      const puProb = (k === 0) ? 1.0 : (Math.abs(k) % 2 === 1 ? 0.70 : 0.50);
      if (rand() < puProb) {
        let puX;
        let puY;
        if (k === 0) {
          // Initial spawn chunk: placed at climb-out altitude right after runway
          puX = chunkStart + 560;
          puY = 160;
        } else {
          puX = chunkStart + 160 + rand() * 680;
          puY = 110 + rand() * 170; // In core visible flight path (110 - 280)
        }

        // Ensure powerup is positioned safely above any structure
        for (const s of structures) {
          if (puX >= s.x - 30 && puX <= s.x + s.width + 30) {
            puY = Math.min(puY, GROUND_Y - s.height - 40);
            break;
          }
        }

        const puType = rand() < 0.5 ? 'speed' : 'gun';
        const pu = new PowerUp(puX, puY, puType);
        if (!collectedPowerUpKeys.has(pu.id)) {
          powerups.push(pu);
        }
      }
    }
  }

  function ensureChunksGenerated(centerX) {
    const minChunk = Math.floor((centerX - 2500) / CHUNK_SIZE);
    const maxChunk = Math.floor((centerX + 2500) / CHUNK_SIZE);

    for (let k = minChunk; k <= maxChunk; k++) {
      generateChunk(k);
    }

    // Cull entities that are too far away (> 4500px) to keep performance snappy
    if (balloons.length > 300) {
      balloons = balloons.filter(b => Math.abs(b.x - centerX) < 4500);
    }
    if (powerups.length > 50) {
      powerups = powerups.filter(pu => Math.abs(pu.x - centerX) < 4500);
    }
    if (structures.length > 80) {
      structures = structures.filter(s => Math.abs(s.x - centerX) < 4500);
    }
    if (airfields.length > 30) {
      airfields = airfields.filter(af => Math.abs(af.startX - centerX) < 5000);
    }
  }

  function updateHazards(dt, player) {
    // Despawn hazards that are far behind or dead
    for (let i = airliners.length - 1; i >= 0; i--) {
      const al = airliners[i];
      al.update(dt);
      if (al.isDead || Math.abs(al.x - player.x) > 2500) {
        airliners.splice(i, 1);
      }
    }

    for (let i = stuntPlanes.length - 1; i >= 0; i--) {
      const sp = stuntPlanes[i];
      sp.update(dt);
      if (sp.isDead || Math.abs(sp.x - player.x) > 2500) {
        stuntPlanes.splice(i, 1);
      }
    }

    for (let i = birdFlocks.length - 1; i >= 0; i--) {
      const bf = birdFlocks[i];
      bf.update(dt);
      if (bf.isDead || Math.abs(bf.x - player.x) > 2500) {
        birdFlocks.splice(i, 1);
      }
    }

    // Desired traffic targets based on current course wave
    const targetAirliners = Math.min(1 + Math.floor(state.wave / 2), 3);
    const targetStuntPlanes = Math.min(1 + Math.floor((state.wave - 1) / 2), 3);
    const targetBirdFlocks = Math.min(2 + Math.floor(state.wave / 2), 4);

    const spawnScale = getLevelSpawnScale();

    // Spawn airliners ahead/east of player (strictly right-to-left flight)
    if (airliners.length < targetAirliners && Math.random() < (0.05 * spawnScale)) {
      const dir = -1;
      const spawnX = player.x + 950 + Math.random() * 500;
      const spawnY = 80 + Math.random() * 150;
      airliners.push(new Airliner(spawnX, spawnY, 85 + Math.random() * 25, dir));
    }

    // Spawn stunt biplanes ahead of player
    if (stuntPlanes.length < targetStuntPlanes && Math.random() < (0.04 * spawnScale)) {
      const dir = player.vx >= 0 ? -1 : 1;
      const spawnX = player.x + (dir === -1 ? 1100 + Math.random() * 600 : -1100 - Math.random() * 600);
      const spawnY = 140 + Math.random() * 120;
      const pattern = Math.random() < 0.5 ? 'loop' : 'wave';
      stuntPlanes.push(new StuntBiplane(spawnX, spawnY, pattern));
    }

    // Spawn bird flocks ahead of player
    if (birdFlocks.length < targetBirdFlocks && Math.random() < (0.05 * spawnScale)) {
      const dir = player.vx >= 0 ? -1 : 1;
      const spawnX = player.x + (dir === -1 ? 850 + Math.random() * 450 : -850 - Math.random() * 450);
      const spawnY = 120 + Math.random() * 180;
      birdFlocks.push(new BirdFlock(spawnX, spawnY, 5));
    }

    // Dynamic timed Power-Up Spawning ahead of player
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.update(dt);
      if (pu.collected || Math.abs(pu.x - player.x) > 3000) {
        powerups.splice(i, 1);
      }
    }

    if (settings.powerups) {
      if (powerupSpawnTimer > 0) {
        powerupSpawnTimer -= dt;
      }

      if (powerupSpawnTimer <= 0 && powerups.length < 2) {
        powerupSpawnTimer = 8.0 + Math.random() * 6.0; // Next dynamic spawn in 8-14s
        const dir = player.vx >= 0 ? 1 : -1;
        const puX = player.x + dir * (700 + Math.random() * 400);
        const puY = 120 + Math.random() * 170; // In core visible flight path (120 - 290)
        const puType = Math.random() < 0.5 ? 'speed' : 'gun';
        const pu = new PowerUp(puX, puY, puType);
        if (!collectedPowerUpKeys.has(pu.id)) {
          powerups.push(pu);
        }
      }
    }

    // Update active bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.update(dt);
      if (b.isDead || Math.abs(b.x - player.x) > 1500) {
        bullets.splice(i, 1);
      }
    }
  }

  function initWorldCourse(wave = 1) {
    state.wave = wave;
    worldSeed = Math.floor(Math.random() * 1000000) + 1;
    powerupSpawnTimer = 6.0;
    generatedChunks.clear();
    poppedBalloonKeys.clear();
    collectedPowerUpKeys.clear();
    airfields = [];
    structures = [];
    balloons = [];
    powerups = [];
    bullets = [];
    airliners = [];
    stuntPlanes = [];
    birdFlocks = [];
    state.balloonsPoppedThisWave = 0;
    state.combo = 1;
    state.lastPoppedX = null;
    state.lastPoppedId = null;

    wind.reset();
    player = new PlayerPlane(80, 220);
    resetWindLeaves();
    ensureChunksGenerated(player.x);
    const speedBonusPct = Math.round((getLevelSpeedScale(wave) - 1) * 100);
    const speedNotice = wave > 1 ? ` (SPEED +${speedBonusPct}%)` : '';
    showStatusBanner(`COURSE ${wave}: FLY BY BALLOONS & BARNS!${speedNotice}`, 3.0, 'info');
  }

  function addScore(pts) {
    state.score += pts;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      Storage.set('flyby_highscore', state.highScore.toString());
    }
    updateHUD();
  }

  function showStatusBanner(text, duration = 2.0, type = 'info') {
    state.bannerText = text;
    state.bannerTimer = duration;
    const banner = domCache.statusBanner;
    if (banner) {
      banner.textContent = text;
      banner.className = `status-banner-${type}`;
      banner.classList.remove('hidden');

      if (duration > 0.3) {
        // Trigger smooth slide-up and fade-out animation matching announcement duration
        banner.style.animation = 'none';
        void banner.offsetWidth; // Force reflow to restart CSS keyframe animation
        banner.style.animation = `banner-slide-fade ${duration}s cubic-bezier(0.2, 0.8, 0.3, 1) forwards`;
      } else {
        // Continuous telemetry updates (e.g. refueling progress, braking airspeed)
        banner.style.animation = 'none';
        banner.style.opacity = '1';
        banner.style.transform = 'translateY(0)';
      }
    }
  }

  function triggerNearMiss(targetX, targetY, typeName, basePoints, hVx = 0, hVy = 0) {
    const pVx = player ? player.vx : 0;
    const pVy = player ? player.vy : 0;
    const relVx = pVx - hVx;
    const relVy = pVy - hVy;
    const relSpeed = Math.hypot(relVx, relVy);

    // Velocity delta multiplier based on relative speed (base cruise reference: 150 px/s)
    const speedMult = Math.max(1.0, relSpeed / 150);
    const points = Math.round(basePoints * speedMult);

    addScore(points);
    state.nearMisses = (state.nearMisses || 0) + 1;
    const midX = (player.x + targetX) / 2;
    const midY = (player.y + targetY) / 2;
    const speedNotice = speedMult > 1.05 ? ` (${speedMult.toFixed(1)}X SPD)` : '';

    addFloatingText(midX, midY - 14, `+${points} NEAR MISS!${speedNotice}`, '#00ffff', 11);
    showStatusBanner(`★ DARING NEAR MISS! +${points} (${typeName}${speedNotice}) ★`, 1.8, 'bonus');
    playSound('near_miss');
    createNearMissBurst(midX, midY);
    state.shake = Math.min(state.shake + 3.5, 7);
  }

  function triggerBarnStormer(s) {
    const pVx = player ? player.vx : 0;
    const relSpeed = Math.abs(pVx);
    const speedMult = Math.max(1.0, relSpeed / 150);
    const points = Math.round(400 * speedMult);

    addScore(points);
    state.nearMisses = (state.nearMisses || 0) + 1;
    const midX = s.x + s.width / 2;
    const speedNotice = speedMult > 1.05 ? ` (${speedMult.toFixed(1)}X SPD)` : '';

    addFloatingText(midX, s.y - 12, `+${points} BARNSTORMER!${speedNotice}`, '#ffd700', 13);
    showStatusBanner(`★ DARING BARNSTORMER! FLEW THROUGH THE BARN! +${points}${speedNotice} ★`, 2.4, 'bonus');
    playSound('near_miss');
    createNearMissBurst(player.x, player.y);
    state.shake = Math.min(state.shake + 4, 8);
  }

  // --- COLLISION DETECTION & TWO-PHASE NEAR MISS SYSTEM ---
  function checkCollisions() {
    if (player.isDead) return;

    // 0. Player vs Ground Near Miss (Buzzing the deck at high speed, awarded upon pulling away)
    if (!player.isDead && !player.onGround && !player.isWobblingCrash && (!player.invulnerableTimer || player.invulnerableTimer <= 0)) {
      if (player.canGroundNearMiss && player.y >= GROUND_Y - 32 && player.airspeed >= 50) {
        player.canGroundNearMiss = false;
        player.groundNearMissPending = true;
      } else if (player.groundNearMissPending && player.y < GROUND_Y - 55) {
        player.groundNearMissPending = false;
        player.canGroundNearMiss = true;
        triggerNearMiss(player.x, GROUND_Y, 'GROUND', 150, 0, 0);
      }
    } else {
      player.groundNearMissPending = false;
    }

    // 1. Player vs Balloons (Pop!)
    for (const b of balloons) {
      if (!b.popped) {
        if (Math.hypot(player.x - b.x, player.y - b.y) < player.width * 0.7 + b.radius) {
          b.pop();
        }
      }
    }

    // 1.5. Power-Ups Collection
    for (const pu of powerups) {
      if (!pu.collected) {
        if (Math.hypot(player.x - pu.x, player.y - pu.y) < player.width * 0.7 + pu.radius) {
          pu.collect(player);
        }
      }
    }

    // 2. Player vs Country Structures (Barns, Silos, Houses, Windmills, Water Towers, Churches)
    for (const s of structures) {
      if (s.checkCollision(player)) {
        s.nearMissPending = false;
        s.nearMissAwarded = true;
        if (s.barnStormPending) s.barnStormPending = false;
        s.ignite();
        player.crash();
        const names = {
          barn: 'BARN',
          house: 'HOUSE',
          windmill: 'WINDMILL',
          silo_set: 'SILO',
          water_tower: 'WATER TOWER',
          church: 'CHURCH'
        };
        const structName = names[s.type] || 'STRUCTURE';
        showStatusBanner(`COLLIDED WITH ${structName}!`, 2.0, 'danger');
        return;
      } else if (!player.isDead && !player.onGround && !player.isWobblingCrash && (!player.invulnerableTimer || player.invulnerableTimer <= 0)) {
        // Barn Fly-Through Stunt Tracking (Barnstormer)
        if (s.type === 'barn') {
          const inGapY = (player.y >= s.gapTop && player.y <= s.gapBottom);
          const inBarnX = (player.x >= s.x && player.x <= s.x + s.width);

          if (inBarnX && inGapY) {
            if (!s.barnStormPending && !s.barnStormAwarded) {
              s.barnStormPending = true;
              s.entryDir = player.vx >= 0 ? 1 : -1;
              createSmokePuff(player.x, player.y + 8, -player.vx * 0.1, -4, 2.5, 'rgba(180,160,130,');
            }
          } else if (s.barnStormPending && !s.barnStormAwarded) {
            const clearedEast = (s.entryDir === 1 && player.x > s.x + s.width + 4);
            const clearedWest = (s.entryDir === -1 && player.x < s.x - 4);
            if (clearedEast || clearedWest) {
              s.barnStormAwarded = true;
              s.barnStormPending = false;
              triggerBarnStormer(s);
            } else if (!inGapY && inBarnX) {
              s.barnStormPending = false;
            }
          }
        }
        let inNearY = (player.y >= s.y - 28 && player.y <= s.y + 12);
        if (s.type === 'church' && player.x > s.x + 28) {
          inNearY = (player.y >= s.y + 10 && player.y <= s.y + 48);
        }
        const inNearX = (player.x >= s.x - 25 && player.x <= s.x + s.width + 25);
        if (!s.nearMissAwarded && !s.nearMissPending && inNearX && inNearY) {
          s.nearMissPending = true;
        } else if (s.nearMissPending && !s.nearMissAwarded) {
          const clearedX = (player.x < s.x - 55 || player.x > s.x + s.width + 55);
          const clearedY = (player.y < s.y - 50 || player.y > s.y + 35 || (s.type === 'church' && player.x > s.x + 28 && (player.y < s.y - 10 || player.y > s.y + 65)));
          if (clearedX || clearedY) {
            s.nearMissAwarded = true;
            s.nearMissPending = false;
            const names = {
              barn: 'BARN',
              house: 'HOUSE',
              windmill: 'WINDMILL',
              silo_set: 'SILO',
              water_tower: 'WATER TOWER',
              church: 'CHURCH'
            };
            const structName = names[s.type] || 'STRUCTURE';
            triggerNearMiss(s.x + s.width / 2, s.y, structName, 200, 0, 0);
          }
        }
      } else {
        s.nearMissPending = false;
      }
    }

    // Player vs Airfield Hangar (only when plane is crashing or stalled)
    if (!player.isDead && (player.isWobblingCrash || player.engineFailed || player.fuel <= 0)) {
      for (const af of airfields) {
        if (af.hangarX !== undefined) {
          if (player.x >= af.hangarX - 4 && player.x <= af.hangarX + 46 && player.y >= GROUND_Y - 32) {
            if (af.igniteHangar) af.igniteHangar();
            player.crash();
            showStatusBanner('COLLIDED WITH HANGAR!', 2.0, 'danger');
            return;
          }
        }
      }
    }

    // 3. Player vs Airliners (Midair Catastrophe: Player shatters, Airliner loses wing and plunges flaming)
    for (const al of airliners) {
      if (!al.isDead && !al.isCrashing) {
        if (al.checkCollision(player)) {
          al.nearMissPending = false;
          al.nearMissAwarded = true;
          al.triggerCrash(player.x, player.y);
          player.breakApart('airliner');
          showStatusBanner('COLLIDED WITH AIRLINER!', 2.5, 'danger');
          return;
        } else if (!player.isDead && (!player.invulnerableTimer || player.invulnerableTimer <= 0)) {
          const dx = Math.abs(player.x - al.x);
          const dy = Math.abs(player.y - al.y);
          if (!al.nearMissAwarded && !al.nearMissPending && dx < 75 && dy < 38) {
            al.nearMissPending = true;
          } else if (al.nearMissPending && !al.nearMissAwarded) {
            if (dx > 115 || dy > 55) {
              al.nearMissAwarded = true;
              al.nearMissPending = false;
              triggerNearMiss(al.x, al.y, 'AIRLINER', 300, al.vx, al.isCrashing ? al.crashVy : 0);
            }
          }
        } else {
          al.nearMissPending = false;
        }
      }
    }

    // 4. Player vs Stunt Biplanes (Mutual Midair Annihilation: Both explode into pieces)
    for (const sp of stuntPlanes) {
      if (!sp.isDead) {
        if (sp.checkCollision(player)) {
          sp.nearMissPending = false;
          sp.nearMissAwarded = true;
          sp.explode();
          player.breakApart('stunt');
          createExplosion((player.x + sp.x) / 2, (player.y + sp.y) / 2, 50);
          state.shake = Math.min(state.shake + 18, 24);
          showStatusBanner('COLLIDED WITH BIPLANE!', 2.5, 'danger');
          return;
        } else if (!player.isDead && (!player.invulnerableTimer || player.invulnerableTimer <= 0)) {
          const dist = Math.hypot(player.x - sp.x, player.y - sp.y);
          if (!sp.nearMissAwarded && !sp.nearMissPending && dist < 56) {
            sp.nearMissPending = true;
          } else if (sp.nearMissPending && !sp.nearMissAwarded) {
            if (dist > 85) {
              sp.nearMissAwarded = true;
              sp.nearMissPending = false;
              triggerNearMiss(sp.x, sp.y, 'BIPLANE', 200, sp.vx, sp.vy);
            }
          }
        } else {
          sp.nearMissPending = false;
        }
      }
    }

    // 5. Player vs Bird Flocks (Bird Strike: Lose tail & engine power -> Wobbly descent)
    for (const bf of birdFlocks) {
      if (bf.checkCollision(player)) {
        bf.nearMissPending = false;
        bf.nearMissAwarded = true;
        player.triggerBirdStrike();
        return;
      } else if (!player.isDead && !player.isWobblingCrash && (!player.invulnerableTimer || player.invulnerableTimer <= 0)) {
        const dist = Math.hypot(player.x - bf.x, player.y - bf.y);
        if (!bf.nearMissAwarded && !bf.nearMissPending && dist < 52) {
          bf.nearMissPending = true;
        } else if (bf.nearMissPending && !bf.nearMissAwarded) {
          if (dist > 80) {
            bf.nearMissAwarded = true;
            bf.nearMissPending = false;
            triggerNearMiss(bf.x, bf.y, 'BIRDS', 150, bf.vx, 0);
          }
        }
      } else {
        bf.nearMissPending = false;
      }
    }
  }

  // --- BACKGROUND & PARALLAX RENDERING ---
  const clouds = [
    { x: 100, y: 55, scale: 1.2, speed: 12 },
    { x: 420, y: 100, scale: 0.9, speed: 8 },
    { x: 800, y: 40, scale: 1.5, speed: 15 },
    { x: 1300, y: 85, scale: 1.0, speed: 10 },
    { x: 1800, y: 120, scale: 1.3, speed: 14 },
    { x: 2300, y: 65, scale: 1.1, speed: 11 }
  ];

  function drawBackground(ctx, camX) {
    // 1. Sky Gradient (Vibrant Sunny Aero Atmosphere)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#1e6091');   // Deep cobalt
    skyGrad.addColorStop(0.4, '#52b69a'); // Emerald teal mid-sky
    skyGrad.addColorStop(0.85, '#99d98c'); // Golden-lime horizon
    skyGrad.addColorStop(1, '#d9ed92');   // Bright sun haze
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, gameWidth, GAME_HEIGHT);

    // 2. Warm Sun (Seamless gentle parallax)
    const sunCycle = gameWidth + 140;
    const sunRenderX = ((gameWidth * 0.82 - (camX * 0.04) % sunCycle) + sunCycle) % sunCycle - 70;
    ctx.fillStyle = '#fff4cc';
    ctx.beginPath();
    ctx.arc(sunRenderX, 65, 32, 0, Math.PI * 2);
    ctx.fill();

    // 3. Distant Mountain Range (Continuous Parallax 0.08x)
    ctx.fillStyle = '#1d3557';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const mStep = 35;
    for (let x = -mStep; x <= gameWidth + mStep; x += mStep) {
      const worldX = x + camX * 0.08;
      const my = GROUND_Y - 95 - Math.sin(worldX * 0.003) * 45 - Math.cos(worldX * 0.009) * 25;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(gameWidth, GROUND_Y);
    ctx.fill();

    // 4. Rolling Country Hills (Continuous Parallax 0.25x)
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const hStep = 30;
    for (let x = -hStep; x <= gameWidth + hStep; x += hStep) {
      const worldX = x + camX * 0.25;
      const hy = GROUND_Y - 45 - Math.sin(worldX * 0.006) * 22;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(gameWidth, GROUND_Y);
    ctx.fill();

    // 5. Fluffy Pixel Clouds (Continuous streaming)
    const diffScale = getLevelSpeedScale();
    for (const cloud of clouds) {
      cloud.x += (cloud.speed * diffScale) * 0.016;
      while (cloud.x < camX - 300) cloud.x += gameWidth + 600;
      while (cloud.x > camX + gameWidth + 300) cloud.x -= gameWidth + 600;

      const renderX = cloud.x - camX * 0.5;
      drawPixelCloud(ctx, renderX, cloud.y, cloud.scale);
    }

    // 6. Ground & Farmland
    ctx.fillStyle = '#52b788'; // Lush grass field
    ctx.fillRect(0, GROUND_Y, gameWidth, GAME_HEIGHT - GROUND_Y);

    ctx.fillStyle = '#2d6a4f'; // Soil underneath
    ctx.fillRect(0, GROUND_Y + 14, gameWidth, GAME_HEIGHT - GROUND_Y - 14);

    // Continuous Country fence posts (skips active airfields)
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 1.5;
    const startFence = Math.floor((camX - 75) / 75) * 75;
    const endFence = camX + gameWidth + 75;
    for (let fx = startFence; fx <= endFence; fx += 75) {
      if (isPointOnAnyRunway(fx, 10)) continue; // Don't build fences across runways!
      const rfx = fx - camX;
      ctx.beginPath();
      ctx.moveTo(rfx, GROUND_Y - 12);
      ctx.lineTo(rfx, GROUND_Y);
      ctx.moveTo(rfx, GROUND_Y - 8);
      ctx.lineTo(rfx + 75, GROUND_Y - 8);
      ctx.stroke();
    }

    // 7. Dynamic Airfields (Runway Tarmac, Markings, Hangars, Windsocks)
    for (const af of airfields) {
      const rwRenderStart = af.startX - camX;
      const rwRenderEnd = af.endX - camX;

      if (rwRenderEnd < -100 || rwRenderStart > gameWidth + 100) continue;

      // Runway Tarmac
      ctx.fillStyle = '#495057';
      ctx.fillRect(rwRenderStart, GROUND_Y - 2, af.length, 6);

      // Runway white markings
      ctx.fillStyle = '#ffffff';
      for (let rx = af.startX + 15; rx < af.endX - 15; rx += 35) {
        ctx.fillRect(rx - camX, GROUND_Y, 18, 2);
      }

      // Airfield Hangar
      const hangarX = af.hangarX - camX;

      ctx.fillStyle = '#6c757d';
      ctx.fillRect(hangarX, GROUND_Y - 28, 42, 28);
      ctx.fillStyle = '#212529';
      ctx.fillRect(hangarX + 6, GROUND_Y - 20, 30, 20);
      ctx.fillStyle = '#9e2a2b';
      ctx.fillRect(hangarX - 2, GROUND_Y - 32, 46, 5);

      // Draw large dancing flames on top of hangar starting at GROUND_Y
      if (af.flames && af.flames.length > 0) {
        const nowSec = Date.now() * 0.0038;
        for (const f of af.flames) {
          const rx = f.x - camX;
          let alpha = 1.0;
          if (f.life > f.maxLife - 0.25) {
            alpha = (f.maxLife - f.life) / 0.25;
          } else if (f.life < 0.6) {
            alpha = f.life / 0.6;
          }
          drawLargeDancingFlame(ctx, rx, GROUND_Y, f.width, f.height, nowSec + f.phase, Math.max(0, Math.min(1.0, alpha)));
        }
      }

      // Windsock on top of Hangar Roof (Not a collision hazard)
      const mastX = hangarX + 21;
      const roofY = GROUND_Y - 32;
      const mastTopY = roofY - 14;

      // Mast pole & swivel pivot finial
      ctx.fillStyle = '#adb5bd';
      ctx.fillRect(mastX - 1, mastTopY, 2, 14);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(mastX - 2, mastTopY - 2, 4, 3); // Pivot cap

      // Dynamic windsock cloth inflation & deflection
      const currentWind = settings.wind ? wind.speed : 0;
      const maxWind = 33.6; // 20% of boosted cruising speed 168
      const windRatio = currentWind / maxWind;
      const windMag = Math.min(1.0, Math.abs(windRatio));
      const windDir = windRatio >= 0 ? 1 : -1;

      // Cloth droop angle: At 0 wind, droops down steeply (~75° from horizontal).
      // At max wind (windMag = 1), dynamic lift raises it to near horizontal (~8° from horizontal).
      const droopAngle = (Math.PI / 2) * (1 - Math.pow(windMag, 0.75) * 0.91);
      const timeMs = Date.now();
      const flutter = Math.sin(timeMs * 0.012 + af.startX * 0.05) * 1.8 * windMag;
      const flutter2 = Math.cos(timeMs * 0.016 + af.startX * 0.05) * 1.2 * windMag;

      const sockLength = 17;
      const numSegments = 4;
      const bandColors = ['#e63946', '#ffffff', '#e63946', '#ffffff'];

      // Generate cross-section points along the windsock cone
      const pts = [];
      for (let i = 0; i <= numSegments; i++) {
        const s = i / numSegments;
        const curAngle = droopAngle + (s * flutter * 0.08);
        const px = mastX + windDir * s * sockLength * Math.cos(curAngle) + (s * s * flutter * windDir);
        const py = mastTopY + 2 + s * sockLength * Math.sin(curAngle) + (s * s * flutter2);
        const halfWidth = 3.2 - s * 1.7; // Tapers from 3.2 to 1.5
        const normX = -Math.sin(curAngle) * halfWidth;
        const normY = Math.cos(curAngle) * halfWidth;

        pts.push({
          topX: px + normX,
          topY: py + normY,
          botX: px - normX,
          botY: py - normY
        });
      }

      // Draw striped tapered cone segments
      for (let i = 0; i < numSegments; i++) {
        ctx.fillStyle = bandColors[i];
        ctx.beginPath();
        ctx.moveTo(pts[i].topX, pts[i].topY);
        ctx.lineTo(pts[i + 1].topX, pts[i + 1].topY);
        ctx.lineTo(pts[i + 1].botX, pts[i + 1].botY);
        ctx.lineTo(pts[i].botX, pts[i].botY);
        ctx.closePath();
        ctx.fill();
      }

      // Dark throat ring / opening
      ctx.strokeStyle = '#212529';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].topX, pts[0].topY);
      ctx.lineTo(pts[0].botX, pts[0].botY);
      ctx.stroke();
    }
  }

  function drawPixelCloud(ctx, x, y, scale) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.beginPath();
    ctx.arc(x, y, 16 * scale, 0, Math.PI * 2);
    ctx.arc(x + 18 * scale, y - 6 * scale, 22 * scale, 0, Math.PI * 2);
    ctx.arc(x + 40 * scale, y, 18 * scale, 0, Math.PI * 2);
    ctx.arc(x + 22 * scale, y + 6 * scale, 16 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- CACHED DOM ELEMENTS ---
  const domCache = {
    // HUD
    score: document.getElementById('score-display'),
    highScore: document.getElementById('high-score-display'),
    balloons: document.getElementById('balloons-display'),
    combo: document.getElementById('combo-display'),
    wave: document.getElementById('wave-display'),
    lives: document.getElementById('lives-display'),
    fuelBar: document.getElementById('fuel-bar'),
    stallWarning: document.getElementById('stall-warning'),
    statusBanner: document.getElementById('status-banner'),
    powerupHud: document.getElementById('powerup-hud'),
    powerupHudLabel: document.getElementById('powerup-hud-label'),
    powerupHudVal: document.getElementById('powerup-hud-val'),
    // Gauges
    barSpd: document.getElementById('bar-spd'),
    valSpd: document.getElementById('val-spd'),
    barAlt: document.getElementById('bar-alt'),
    valAlt: document.getElementById('val-alt'),
    barAoa: document.getElementById('bar-aoa'),
    valAoa: document.getElementById('val-aoa'),
    barThr: document.getElementById('bar-thr'),
    valThr: document.getElementById('val-thr'),
    windGaugeCanvas: document.getElementById('wind-gauge-canvas'),
    valWind: document.getElementById('val-wind'),
    instrumentPanel: document.getElementById('instrument-panel'),
    crtOverlay: document.getElementById('crt-overlay'),
    // Screens & Overlays
    settingsModal: document.getElementById('settings-modal'),
    gameoverScreen: document.getElementById('gameover-screen'),
    titleScreen: document.getElementById('title-screen'),
    finalScore: document.getElementById('final-score'),
    finalWave: document.getElementById('final-wave'),
    finalPopped: document.getElementById('final-popped'),
    finalNearMisses: document.getElementById('final-nearmisses'),
    finalCombo: document.getElementById('final-combo'),
    // Settings inputs
    settingInvertY: document.getElementById('setting-invert-y'),
    settingPowerups: document.getElementById('setting-powerups'),
    startInvertY: document.getElementById('start-invert-y'),
    startPowerups: document.getElementById('start-powerups'),
    settingTouchControls: document.getElementById('setting-touch-controls'),
    settingInstruments: document.getElementById('setting-instruments'),
    settingScanlines: document.getElementById('setting-scanlines'),
    settingEngineSound: document.getElementById('setting-engine-sound'),
    settingWind: document.getElementById('setting-wind'),
    // Action buttons & touch overlays
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    touchControls: document.getElementById('touch-controls'),
    touchBtnThrottle: document.getElementById('touch-btn-throttle'),
    touchBtnUp: document.getElementById('touch-btn-up'),
    touchBtnDown: document.getElementById('touch-btn-down'),
    touchBtnFire: document.getElementById('touch-btn-fire'),
    orientationHint: document.getElementById('orientation-hint')
  };

  let windGaugeCtx = null;

  // --- DIRTY-CHECKING STATE TRACKERS ---
  const hudDirty = {
    score: -1,
    highScore: -1,
    balloons: -1,
    combo: -1,
    comboActive: null,
    wave: -1,
    lives: -1,
    fuelPct: -1,
    fuelLow: null,
    stalled: null
  };

  const gaugeDirty = {
    windText: '',
    spdRatio: -1,
    spdVal: -1,
    altRatio: -1,
    altVal: -1,
    aoaTop: '',
    aoaBottom: '',
    aoaHeight: '',
    aoaColor: '',
    aoaStalled: null,
    aoaValText: '',
    aoaValColor: '',
    thrRatio: -1,
    thrText: ''
  };

  // --- COCKPIT INSTRUMENTS DASHBOARD ---
  function updateInstruments() {
    if (!settings.showInstruments || !player) return;

    // 0. WIND (Mini Windsock)
    if (domCache.windGaugeCanvas) {
      if (!windGaugeCtx) {
        windGaugeCtx = domCache.windGaugeCanvas.getContext('2d');
      }
      if (windGaugeCtx) {
        const currentWind = settings.wind ? wind.speed : 0;
        const roundedWind = Math.round(Math.abs(currentWind));
        const dirSym = currentWind > 1.5 ? '▶' : (currentWind < -1.5 ? '◀' : '');
        const windText = dirSym ? `${dirSym}${roundedWind}` : `${roundedWind}`;

        if (windText !== gaugeDirty.windText && domCache.valWind) {
          domCache.valWind.textContent = windText;
          gaugeDirty.windText = windText;
        }

        // Draw animated mini windsock on gauge canvas (34 x 24)
        windGaugeCtx.clearRect(0, 0, 34, 24);

        // Mast pole & finial
        const mastX = 17;
        const mastTopY = 4;
        windGaugeCtx.fillStyle = '#adb5bd';
        windGaugeCtx.fillRect(mastX - 1, mastTopY, 2, 17);
        windGaugeCtx.fillStyle = '#ffd166';
        windGaugeCtx.fillRect(mastX - 2, mastTopY - 1, 4, 2);

        // Dynamic mini windsock
        const maxWind = 33.6; // 20% of boosted cruising speed 168
        const windRatio = currentWind / maxWind;
        const windMag = Math.min(1.0, Math.abs(windRatio));
        const windDir = windRatio >= 0 ? 1 : -1;

        const droopAngle = (Math.PI / 2) * (1 - Math.pow(windMag, 0.75) * 0.88);
        const timeMs = Date.now();
        const flutter = Math.sin(timeMs * 0.012) * 1.3 * windMag;
        const flutter2 = Math.cos(timeMs * 0.016) * 0.9 * windMag;

        const sockLength = 13;
        const numSegments = 4;
        const bandColors = ['#e63946', '#ffffff', '#e63946', '#ffffff'];

        const pts = [];
        for (let i = 0; i <= numSegments; i++) {
          const s = i / numSegments;
          const curAngle = droopAngle + (s * flutter * 0.08);
          const px = mastX + windDir * s * sockLength * Math.cos(curAngle) + (s * s * flutter * windDir);
          const py = mastTopY + 2 + s * sockLength * Math.sin(curAngle) + (s * s * flutter2);
          const halfWidth = 2.4 - s * 1.2;
          const normX = -Math.sin(curAngle) * halfWidth;
          const normY = Math.cos(curAngle) * halfWidth;

          pts.push({
            topX: px + normX,
            topY: py + normY,
            botX: px - normX,
            botY: py - normY
          });
        }

        for (let i = 0; i < numSegments; i++) {
          windGaugeCtx.fillStyle = bandColors[i];
          windGaugeCtx.beginPath();
          windGaugeCtx.moveTo(pts[i].topX, pts[i].topY);
          windGaugeCtx.lineTo(pts[i + 1].topX, pts[i + 1].topY);
          windGaugeCtx.lineTo(pts[i + 1].botX, pts[i + 1].botY);
          windGaugeCtx.lineTo(pts[i].botX, pts[i].botY);
          windGaugeCtx.closePath();
          windGaugeCtx.fill();
        }

        windGaugeCtx.strokeStyle = '#212529';
        windGaugeCtx.lineWidth = 0.8;
        windGaugeCtx.beginPath();
        windGaugeCtx.moveTo(pts[0].topX, pts[0].topY);
        windGaugeCtx.lineTo(pts[0].botX, pts[0].botY);
        windGaugeCtx.stroke();
      }
    }

    // 1. SPD (Speed)
    const v = player.airspeed;
    const minSpd = player.stallSpeed || 52;
    const maxSpd = player.maxDiveSpeed || 396;
    let spdRatio = 0;
    if (!player.isStopped && !player.stalled && v > minSpd) {
      spdRatio = Math.max(0, Math.min(1, (v - minSpd) / (maxSpd - minSpd)));
    }
    const roundedSpd = Math.round(v);
    const spdPct = (spdRatio * 100).toFixed(1);
    if (spdRatio !== gaugeDirty.spdRatio && domCache.barSpd) {
      domCache.barSpd.style.height = `${spdPct}%`;
      gaugeDirty.spdRatio = spdRatio;
    }
    if (roundedSpd !== gaugeDirty.spdVal && domCache.valSpd) {
      domCache.valSpd.textContent = roundedSpd.toString();
      gaugeDirty.spdVal = roundedSpd;
    }

    // 2. ALT (Altitude)
    const alt = Math.max(0, GROUND_Y - player.y);
    const maxAlt = GROUND_Y - 18;
    const altRatio = Math.max(0, Math.min(1, alt / maxAlt));
    const roundedAlt = Math.round(alt);
    if (altRatio !== gaugeDirty.altRatio && domCache.barAlt) {
      domCache.barAlt.style.height = `${(altRatio * 100).toFixed(1)}%`;
      gaugeDirty.altRatio = altRatio;
    }
    if (roundedAlt !== gaugeDirty.altVal && domCache.valAlt) {
      domCache.valAlt.textContent = roundedAlt.toString();
      gaugeDirty.altVal = roundedAlt;
    }

    // 3. AOA (Angle of Attack)
    const aoa = player.angleOfAttack;
    const criticalAoA = 0.65;
    let normAoA = 0;
    if (player.stalled) {
      normAoA = aoa >= 0 ? 1 : -1;
    } else {
      normAoA = Math.max(-1, Math.min(1, aoa / criticalAoA));
    }
    const fillPct = `${(Math.abs(normAoA) * 50).toFixed(1)}%`;
    const isTop = normAoA < 0;
    const bottomVal = isTop ? 'auto' : '50%';
    const topVal = isTop ? '50%' : 'auto';

    if (domCache.barAoa) {
      if (bottomVal !== gaugeDirty.aoaBottom || topVal !== gaugeDirty.aoaTop || fillPct !== gaugeDirty.aoaHeight) {
        domCache.barAoa.style.bottom = bottomVal;
        domCache.barAoa.style.top = topVal;
        domCache.barAoa.style.height = fillPct;
        gaugeDirty.aoaBottom = bottomVal;
        gaugeDirty.aoaTop = topVal;
        gaugeDirty.aoaHeight = fillPct;
      }

      const absNorm = Math.abs(normAoA);
      let aoaColor = '#38ef7d';
      const isAoAStalled = !!(player.stalled || absNorm >= 0.80);
      if (isAoAStalled) {
        aoaColor = '#ff2222';
      } else if (absNorm >= 0.42) {
        aoaColor = '#ffcc00';
      }

      if (aoaColor !== gaugeDirty.aoaColor) {
        domCache.barAoa.style.backgroundColor = aoaColor;
        domCache.barAoa.style.boxShadow = `0 0 6px ${aoaColor}`;
        gaugeDirty.aoaColor = aoaColor;
      }

      if (isAoAStalled !== gaugeDirty.aoaStalled) {
        if (isAoAStalled) domCache.barAoa.classList.add('stalled');
        else domCache.barAoa.classList.remove('stalled');
        gaugeDirty.aoaStalled = isAoAStalled;
      }
    }

    if (domCache.valAoa) {
      let aoaText = '';
      let aoaTextColor = '#ffdf40';
      if (player.stalled) {
        aoaText = 'STALL';
        aoaTextColor = '#ff2222';
      } else {
        const deg = Math.round(aoa * (180 / Math.PI));
        aoaText = `${deg > 0 ? '+' : ''}${deg}°`;
        aoaTextColor = '#ffdf40';
      }

      if (aoaText !== gaugeDirty.aoaText || aoaTextColor !== gaugeDirty.aoaTextColor) {
        domCache.valAoa.textContent = aoaText;
        domCache.valAoa.style.color = aoaTextColor;
        gaugeDirty.aoaText = aoaText;
        gaugeDirty.aoaTextColor = aoaTextColor;
      }
    }

    // 4. THR (Throttle)
    let thrRatio = 0;
    let thrText = 'IDLE';

    if (player.onGround) {
      if (player.isStopped) {
        thrRatio = player.throttleUp ? player.rpm : 0;
        thrText = player.throttleUp ? 'MAX' : 'STOP';
      } else if (player.isBraking) {
        thrRatio = 0;
        thrText = 'BRK';
      } else if (player.throttleUp) {
        thrRatio = player.rpm;
        thrText = 'MAX';
      } else {
        thrRatio = 0.15;
        thrText = 'ROLL';
      }
    } else {
      if (player.fuel <= 0) {
        thrRatio = 0;
        thrText = 'CUT';
      } else if (player.isIdle) {
        thrRatio = 0;
        thrText = 'IDLE';
      } else {
        thrRatio = 1.0;
        thrText = 'MAX';
      }
    }

    if (thrRatio !== gaugeDirty.thrRatio && domCache.barThr) {
      domCache.barThr.style.height = `${(thrRatio * 100).toFixed(1)}%`;
      gaugeDirty.thrRatio = thrRatio;
    }
    if (thrText !== gaugeDirty.thrText && domCache.valThr) {
      domCache.valThr.textContent = thrText;
      gaugeDirty.thrText = thrText;
    }
  }

  function updateHUD() {
    if (state.score !== hudDirty.score && domCache.score) {
      domCache.score.textContent = state.score.toString().padStart(5, '0');
      hudDirty.score = state.score;
    }

    if (state.highScore !== hudDirty.highScore && domCache.highScore) {
      domCache.highScore.textContent = state.highScore.toString().padStart(5, '0');
      hudDirty.highScore = state.highScore;
    }

    if (state.balloonsPopped !== hudDirty.balloons && domCache.balloons) {
      domCache.balloons.textContent = state.balloonsPopped.toString();
      hudDirty.balloons = state.balloonsPopped;
    }

    if (state.combo !== hudDirty.combo && domCache.combo) {
      if (state.combo > 1) {
        const bonusPct = Math.round((state.combo - 1) * 5);
        const mult = (1 + (state.combo - 1) * 0.05).toFixed(2);
        domCache.combo.textContent = `x${mult} (+${bonusPct}%)`;
        if (!hudDirty.comboActive) {
          domCache.combo.classList.add('active');
          hudDirty.comboActive = true;
        }
      } else {
        domCache.combo.textContent = 'x1.00';
        if (hudDirty.comboActive) {
          domCache.combo.classList.remove('active');
          hudDirty.comboActive = false;
        }
      }
      hudDirty.combo = state.combo;
    }

    if (state.wave !== hudDirty.wave && domCache.wave) {
      domCache.wave.textContent = state.wave.toString();
      hudDirty.wave = state.wave;
    }

    if (state.lives !== hudDirty.lives && domCache.lives) {
      domCache.lives.textContent = '✈ '.repeat(Math.max(0, state.lives)).trim();
      hudDirty.lives = state.lives;
    }

    if (player) {
      const fuelPercent = Math.round((player.fuel / player.maxFuel) * 100);
      if (fuelPercent !== hudDirty.fuelPct && domCache.fuelBar) {
        domCache.fuelBar.style.width = `${fuelPercent}%`;
        const isLow = fuelPercent < 25;
        if (isLow !== hudDirty.fuelLow) {
          if (isLow) domCache.fuelBar.classList.add('low');
          else domCache.fuelBar.classList.remove('low');
          hudDirty.fuelLow = isLow;
        }
        hudDirty.fuelPct = fuelPercent;
      }

      const isStalled = !!(player.stalled && !player.isDead);
      if (isStalled !== hudDirty.stalled && domCache.stallWarning) {
        if (isStalled) domCache.stallWarning.classList.remove('hidden');
        else domCache.stallWarning.classList.add('hidden');
        hudDirty.stalled = isStalled;
      }

      // Dynamic Power-Up HUD Indicator
      if (domCache.powerupHud) {
        let puActive = false;
        let puLabel = 'POWERUP';
        let puVal = '';
        let puType = '';

        if (player.speedBoostTimer > 0) {
          puActive = true;
          puLabel = 'BOOST';
          puVal = `⚡ ${player.speedBoostTimer.toFixed(1)}s`;
          puType = 'speed';
        } else if (player.gunTimer > 0 || player.gunAmmo > 0) {
          puActive = true;
          puLabel = 'GUN';
          puVal = `🎯 ${player.gunAmmo}R (${player.gunTimer.toFixed(1)}s)`;
          puType = 'gun';
        }

        if (puActive) {
          domCache.powerupHud.classList.remove('hidden');
          domCache.powerupHud.className = `hud-box powerup-box ${puType}`;
          if (domCache.powerupHudLabel) domCache.powerupHudLabel.textContent = puLabel;
          if (domCache.powerupHudVal) {
            domCache.powerupHudVal.textContent = puVal;
            domCache.powerupHudVal.className = `hud-value powerup-val ${puType}`;
          }
        } else {
          domCache.powerupHud.classList.add('hidden');
        }
      }

      // Dynamic Mobile Touch FIRE Button Visibility
      if (domCache.touchBtnFire) {
        const hasGun = (player.gunTimer > 0 || player.gunAmmo > 0) && !player.isDead;
        if (hasGun) {
          domCache.touchBtnFire.classList.remove('hidden');
        } else {
          domCache.touchBtnFire.classList.add('hidden');
        }
      }
    }
  }

  // --- GAME OVER & RESPAWN ---
  let gameOverTimeout = null;
  let respawnTimeout = null;

  function handlePlayerDeath() {
    state.lives--;
    state.combo = 1;
    state.lastPoppedX = null;
    state.lastPoppedId = null;
    updateHUD();

    if (state.lives <= 0) {
      state.gameOver = true;
      if (domCache.finalScore) domCache.finalScore.textContent = state.score;
      if (domCache.finalWave) domCache.finalWave.textContent = state.wave;
      if (domCache.finalPopped) domCache.finalPopped.textContent = state.balloonsPopped;
      if (domCache.finalNearMisses) domCache.finalNearMisses.textContent = state.nearMisses || 0;
      const maxBonusPct = Math.round((state.maxCombo - 1) * 5);
      const maxMult = (1 + (state.maxCombo - 1) * 0.05).toFixed(2);
      if (domCache.finalCombo) {
        domCache.finalCombo.textContent = state.maxCombo > 1
          ? `x${maxMult} (+${maxBonusPct}%) [${state.maxCombo} Streak]`
          : 'x1.00';
      }
      if (gameOverTimeout) clearTimeout(gameOverTimeout);
      gameOverTimeout = setTimeout(() => {
        if (state.gameOver && domCache.gameoverScreen) {
          domCache.gameoverScreen.classList.remove('hidden');
          const restartBtn = document.getElementById('restart-btn');
          if (restartBtn) {
            try { restartBtn.focus(); } catch (_) {}
          }
        }
      }, 1200);
    } else {
      if (respawnTimeout) clearTimeout(respawnTimeout);
      respawnTimeout = setTimeout(() => {
        if (!state.gameOver) {
          player = new PlayerPlane(player.x, 220);
          showStatusBanner('NEW BIPLANE AIRBORNE!', 2.0, 'info');
        }
      }, 1800);
    }
  }

  function restartGame() {
    initAudio();
    if (gameOverTimeout) {
      clearTimeout(gameOverTimeout);
      gameOverTimeout = null;
    }
    if (respawnTimeout) {
      clearTimeout(respawnTimeout);
      respawnTimeout = null;
    }
    if (document.activeElement && document.activeElement.blur) {
      try { document.activeElement.blur(); } catch (_) {}
    }
    keys.space = false;
    keys.boost = false;
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.fire = false;

    state.score = 0;
    state.wave = 1;
    state.lives = 3;
    state.balloonsPopped = 0;
    state.nearMisses = 0;
    state.combo = 1;
    state.maxCombo = 1;
    state.lastPoppedX = null;
    state.lastPoppedId = null;
    state.gameOver = false;
    state.running = true;

    wind.reset();
    player = new PlayerPlane(80, 220);
    particles.length = 0;
    floatingTexts.length = 0;

    initWorldCourse(1);
    updateHUD();

    if (domCache.gameoverScreen) domCache.gameoverScreen.classList.add('hidden');
    if (domCache.titleScreen) domCache.titleScreen.classList.add('hidden');
  }

  // --- MAIN UPDATE & RENDER LOOP ---
  let lastTime = performance.now();

  function gameLoop(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;

    if (state.running && !state.paused) {
      update(dt);
    } else {
      updateEngineSound(player, dt);
      updateAirlinersSound(player, dt);
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    // 0. Dynamic Atmospheric Wind Simulation
    wind.update(dt);

    // 0.5. Atmospheric Wind Gusts Update (Swirling Leaves)
    updateWindLeaves(dt);

    // 1. Player Input
    let pitchUp = false;
    let pitchDown = false;

    if (settings.invertY) {
      if (keys.down || touchState.btnDown) pitchUp = true;
      if (keys.up || touchState.btnUp) pitchDown = true;
    } else {
      if (keys.up || touchState.btnUp) pitchUp = true;
      if (keys.down || touchState.btnDown) pitchDown = true;
    }

    if (!player.isDead) {
      player.update(dt, {
        pitchUp,
        pitchDown,
        space: keys.space || keys.boost || touchState.throttle,
        boost: keys.boost || touchState.throttle,
        fire: keys.fire || touchState.btnFire
      });
    } else if (state.lives > 0 && !player.handledDeath) {
      player.handledDeath = true;
      handlePlayerDeath();
    }

    // 3. Dynamic World & Camera Tracking
    ensureChunksGenerated(player.x);
    state.cameraX = player.x - gameWidth * 0.33;

    // 4. Screen Shake Decay
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - 20 * dt);
    }

    // 5. Status Banner Timer
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0 && domCache.statusBanner) {
        domCache.statusBanner.classList.add('hidden');
        domCache.statusBanner.style.animation = 'none';
      }
    }

    // 6. Balloons Update
    for (const b of balloons) {
      b.update(dt);
    }

    // 7. Countryside Structures & Airfields Update
    for (const s of structures) {
      s.update(dt);
    }
    for (const af of airfields) {
      if (af.update) af.update(dt);
    }

    // 8. Dynamic Hazards Update
    updateHazards(dt, player);

    // 9. Floating Text Update (Fast swap-and-pop O(1) removal)
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt * 1.2;
      if (ft.life <= 0) {
        floatingTexts[i] = floatingTexts[floatingTexts.length - 1];
        floatingTexts.pop();
      }
    }

    // 10. Particles Update (Fast swap-and-pop O(1) removal)
    const currentWind = settings.wind ? wind.speed : 0;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (p.isFeather) {
        p.flutter += p.flutterSpeed * dt;
        p.x += (p.vx + Math.sin(p.flutter) * 18 + currentWind * 0.4) * dt;
        p.y += (p.vy + 22) * dt;
        p.rotation += p.rotSpeed * dt;
        p.life -= p.decay * dt;
        if (p.y >= GROUND_Y - 2) {
          p.y = GROUND_Y - 2;
          p.vx *= 0.85;
          p.rotSpeed = 0;
        }
      } else if (p.isSmoke) {
        p.x += (p.vx + currentWind * 0.35) * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
      } else if (p.isDebris) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.rotation += p.rotSpeed * dt;
        p.life -= p.decay * dt;

        if (p.smoking) {
          p.smokeTimer += dt;
          if (p.smokeTimer > 0.05) {
            p.smokeTimer = 0;
            createSmokePuff(p.x, p.y, -p.vx * 0.1, -p.vy * 0.1, 3.2, 'rgba(70,70,70,');
          }
        }

        // Ground bounce physics
        if (p.y >= GROUND_Y - 2) {
          p.y = GROUND_Y - 2;
          p.vy = -p.vy * p.bounce;
          p.vx *= 0.65;
          p.rotSpeed *= 0.5;
          if (Math.abs(p.vy) < 18) {
            p.vy = 0;
            p.rotSpeed = 0;
          }
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.gravity) p.vy += p.gravity * dt;
        p.life -= p.decay * dt;
        if (p.rotSpeed) p.rotation += p.rotSpeed * dt;
      }

      if (p.life <= 0 || p.y > GROUND_Y + 20) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
      }
    }

    // 11. Collisions & Instruments
    checkCollisions();
    updateInstruments();
    updateHUD();

    // 12. Dynamic Airplane & Airliner Sound
    updateEngineSound(player, dt);
    updateAirlinersSound(player, dt);
  }

  function render() {
    ctx.save();

    // Apply Screen Shake (scaled down 20% for visual clarity during heavy action)
    if (state.shake > 0) {
      const shakeMag = state.shake * 0.8;
      const rx = (Math.random() - 0.5) * shakeMag;
      const ry = (Math.random() - 0.5) * shakeMag;
      ctx.translate(rx, ry);
    }

    // 1. Draw Parallax World Background
    drawBackground(ctx, state.cameraX);

    // 2. Draw Country Structures (Barns, Silos, Windmills, Water Towers, Churches)
    for (const s of structures) {
      if (s.x - state.cameraX >= -200 && s.x - state.cameraX <= gameWidth + 200) {
        s.draw(ctx, state.cameraX);
      }
    }

    // 2.5. Draw Atmospheric Wind Gust Leaves
    drawWindLeaves(ctx, state.cameraX);

    // 3. Draw Balloons
    for (const b of balloons) {
      if (!b.popped && b.x - state.cameraX >= -80 && b.x - state.cameraX <= gameWidth + 80) {
        b.draw(ctx, state.cameraX);
      }
    }

    // 3.5. Draw Power-Ups (Bouncing Badges)
    for (const pu of powerups) {
      if (!pu.collected && pu.x - state.cameraX >= -80 && pu.x - state.cameraX <= gameWidth + 80) {
        pu.draw(ctx, state.cameraX);
      }
    }

    // 4. Draw Airliners
    for (const al of airliners) {
      al.draw(ctx, state.cameraX);
    }

    // 5. Draw Stunt Biplanes
    for (const sp of stuntPlanes) {
      sp.draw(ctx, state.cameraX);
    }

    // 6. Draw Bird Flocks
    for (const bf of birdFlocks) {
      bf.draw(ctx, state.cameraX);
    }

    // 6.5. Draw Bullets (Tracers)
    for (const b of bullets) {
      b.draw(ctx, state.cameraX);
    }

    // 7. Draw Player Plane
    player.draw(ctx, state.cameraX);

    // 7.5. Draw Country Structures Foreground (Front Walls & Obscuration)
    for (const s of structures) {
      if (s.drawForeground && s.x - state.cameraX >= -200 && s.x - state.cameraX <= gameWidth + 200) {
        s.drawForeground(ctx, state.cameraX);
      }
    }

    // 8. Draw Particles (Smoke, Fire, Feathers, Debris & Confetti)
    for (const p of particles) {
      const rx = p.x - state.cameraX;

      if (p.isSmoke) {
        const radius = Math.max(0, p.size * (2.2 - p.life));
        if (radius > 0) {
          ctx.fillStyle = `${p.color}${Math.max(0, p.life * 0.75)})`;
          ctx.beginPath();
          ctx.arc(rx, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.isFire) {
        const radius = Math.max(0, p.size * (1.5 - p.life * 0.5));
        if (radius > 0) {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, Math.min(1.0, p.life));
          ctx.beginPath();
          ctx.arc(rx, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      } else if (p.isFeather) {
        ctx.save();
        ctx.translate(rx, p.y);
        ctx.rotate(p.rotation + Math.sin(p.flutter) * 0.4);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.isConfetti) {
        ctx.save();
        ctx.translate(rx, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        ctx.restore();
      } else if (p.isDebris) {
        ctx.save();
        ctx.translate(rx, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.min(1.0, p.life / 0.5);

        if (p.type === 'wing') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          if (p.accentColor) {
            ctx.fillStyle = p.accentColor;
            ctx.fillRect(-p.width / 2 + 2, -p.height / 2 + 1, 3, p.height - 2);
          }
        } else if (p.type === 'fuselage') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          ctx.fillStyle = '#111111';
          ctx.fillRect(-p.width / 4, -p.height / 2, p.width / 2, 2);
        } else if (p.type === 'prop') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          ctx.fillStyle = '#333333';
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'tail') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.width / 2, p.height / 2);
          ctx.lineTo(p.width / 2, p.height / 2);
          ctx.lineTo(p.width / 4, -p.height / 2);
          ctx.lineTo(-p.width / 4, -p.height / 2);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'airliner_wing') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.width / 2, -p.height / 4);
          ctx.lineTo(p.width / 2, -p.height / 2);
          ctx.lineTo(p.width / 3, p.height / 2);
          ctx.lineTo(-p.width / 3, p.height / 2);
          ctx.closePath();
          ctx.fill();
          // Engine pod
          ctx.fillStyle = p.accentColor || '#495057';
          ctx.fillRect(-4, 0, 10, 5);
        } else if (p.type === 'airliner_hull') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          if (p.accentColor) {
            ctx.fillStyle = p.accentColor;
            ctx.fillRect(-p.width / 2, -1, p.width, 3);
          }
        } else if (p.type === 'airliner_nose') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.width / 2, -p.height / 2);
          ctx.lineTo(p.width / 2, 0);
          ctx.lineTo(-p.width / 2, p.height / 2);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'airliner_tail') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.width / 2, p.height / 2);
          ctx.lineTo(p.width / 2, p.height / 2);
          ctx.lineTo(-p.width / 4, -p.height / 2);
          ctx.lineTo(-p.width / 2, -p.height / 2);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'engine') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          ctx.fillStyle = '#00b4d8';
          ctx.fillRect(p.width / 2 - 2, -p.height / 4, 2, p.height / 2);
        } else if (p.type === 'wheel') {
          ctx.fillStyle = '#333333';
          ctx.beginPath();
          ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'scarf') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        }

        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(rx - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    // 9. Draw Floating Texts
    for (const ft of floatingTexts) {
      const rx = ft.x - state.cameraX;
      ctx.save();
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = `${ft.size}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, rx, ft.y);
      ctx.restore();
    }

    ctx.restore();

    // 10. Pause Screen Indicator (when paused during active flight)
    if (state.running && !state.gameOver && state.paused && domCache.settingsModal && domCache.settingsModal.classList.contains('hidden')) {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 12, 18, 0.65)';
      ctx.fillRect(0, 0, gameWidth, GAME_HEIGHT);

      ctx.fillStyle = '#ffdf40';
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText('PAUSED', gameWidth / 2, GAME_HEIGHT / 2 - 10);

      ctx.fillStyle = '#79a6d2';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText('PRESS P / ⏸ TO RESUME | ESC FOR SETTINGS', gameWidth / 2, GAME_HEIGHT / 2 + 25);
      ctx.restore();
    }
  }

  // --- SETTINGS MODAL & UI HANDLERS ---
  function updateTouchControlsUI() {
    if (domCache.touchBtnUp) {
      const icon = domCache.touchBtnUp.querySelector('.touch-icon');
      const label = domCache.touchBtnUp.querySelector('.touch-label');
      if (settings.invertY) {
        if (icon) icon.textContent = '▲';
        if (label) label.textContent = 'DIVE';
        domCache.touchBtnUp.setAttribute('aria-label', 'Dive / Pitch Down (Stick Forward)');
      } else {
        if (icon) icon.textContent = '▲';
        if (label) label.textContent = 'CLIMB';
        domCache.touchBtnUp.setAttribute('aria-label', 'Climb / Pitch Up');
      }
    }
    if (domCache.touchBtnDown) {
      const icon = domCache.touchBtnDown.querySelector('.touch-icon');
      const label = domCache.touchBtnDown.querySelector('.touch-label');
      if (settings.invertY) {
        if (icon) icon.textContent = '▼';
        if (label) label.textContent = 'CLIMB';
        domCache.touchBtnDown.setAttribute('aria-label', 'Climb / Pitch Up (Stick Back)');
      } else {
        if (icon) icon.textContent = '▼';
        if (label) label.textContent = 'DIVE';
        domCache.touchBtnDown.setAttribute('aria-label', 'Dive / Pitch Down');
      }
    }
  }

  function applyTouchControlsVisibility() {
    const wrapper = document.getElementById('game-wrapper');
    if (!wrapper) return;
    wrapper.classList.remove('force-show-touch', 'force-hide-touch');
    if (settings.touchControls === 'always') {
      wrapper.classList.add('force-show-touch');
    } else if (settings.touchControls === 'off') {
      wrapper.classList.add('force-hide-touch');
    }
  }

  function toggleSettings() {
    if (!domCache.settingsModal) return;
    if (domCache.settingsModal.classList.contains('hidden')) {
      openSettings();
    } else {
      closeSettings();
    }
  }

  function toggleMute() {
    settings.engineSound = !settings.engineSound;
    Storage.set('flyby_engine_sound', settings.engineSound.toString());
    if (domCache.settingEngineSound) domCache.settingEngineSound.checked = settings.engineSound;

    if (masterAudioGain && audioCtx) {
      masterAudioGain.gain.setTargetAtTime(settings.engineSound ? 1.0 : 0.0, audioCtx.currentTime, 0.04);
    }

    if (!settings.engineSound) {
      showStatusBanner('AUDIO MUTED (M)', 1.5, 'warning');
    } else {
      initAudio();
      showStatusBanner('AUDIO ENABLED (M)', 1.5, 'info');
    }
  }

  function applyPowerupsSetting() {
    if (!settings.powerups) {
      powerups.length = 0;
      if (player) {
        player.speedBoostTimer = 0;
        player.gunTimer = 0;
        player.gunAmmo = 0;
      }
      if (domCache.powerupHud) domCache.powerupHud.classList.add('hidden');
      if (domCache.touchBtnFire) domCache.touchBtnFire.classList.add('hidden');
    }
  }

  function openSettings() {
    initAudio();
    state.paused = true;
    updatePauseBtnIcon();
    if (domCache.settingInvertY) domCache.settingInvertY.checked = settings.invertY;
    if (domCache.startInvertY) domCache.startInvertY.checked = settings.invertY;
    if (domCache.settingPowerups) domCache.settingPowerups.checked = settings.powerups;
    if (domCache.startPowerups) domCache.startPowerups.checked = settings.powerups;
    if (domCache.settingTouchControls) domCache.settingTouchControls.value = settings.touchControls || 'auto';
    if (domCache.settingInstruments) domCache.settingInstruments.checked = settings.showInstruments;
    if (domCache.settingScanlines) domCache.settingScanlines.checked = settings.scanlines;
    if (domCache.settingEngineSound) domCache.settingEngineSound.checked = settings.engineSound;
    if (domCache.settingWind) domCache.settingWind.checked = settings.wind;
    if (domCache.settingsModal) domCache.settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    if (domCache.settingInvertY) {
      settings.invertY = domCache.settingInvertY.checked;
      Storage.set('flyby_invert_y', settings.invertY.toString());
      if (domCache.startInvertY) domCache.startInvertY.checked = settings.invertY;
      updateTouchControlsUI();
    }
    if (domCache.settingPowerups) {
      settings.powerups = domCache.settingPowerups.checked;
      Storage.set('flyby_powerups', settings.powerups.toString());
      if (domCache.startPowerups) domCache.startPowerups.checked = settings.powerups;
      applyPowerupsSetting();
    }
    if (domCache.settingTouchControls) {
      settings.touchControls = domCache.settingTouchControls.value;
      Storage.set('flyby_touch_controls', settings.touchControls);
      applyTouchControlsVisibility();
    }
    if (domCache.settingInstruments) {
      settings.showInstruments = domCache.settingInstruments.checked;
      Storage.set('flyby_instruments', settings.showInstruments.toString());
    }
    if (domCache.settingScanlines) {
      settings.scanlines = domCache.settingScanlines.checked;
      Storage.set('flyby_scanlines', settings.scanlines.toString());
    }
    if (domCache.settingEngineSound) {
      settings.engineSound = domCache.settingEngineSound.checked;
      Storage.set('flyby_engine_sound', settings.engineSound.toString());
      if (masterAudioGain && audioCtx) {
        masterAudioGain.gain.setTargetAtTime(settings.engineSound ? 1.0 : 0.0, audioCtx.currentTime, 0.04);
      }
    }
    if (domCache.settingWind) {
      settings.wind = domCache.settingWind.checked;
      Storage.set('flyby_wind', settings.wind.toString());
      if (!settings.wind) {
        wind.speed = 0;
        wind.targetSpeed = 0;
      }
    }

    if (domCache.instrumentPanel) {
      domCache.instrumentPanel.style.display = settings.showInstruments ? 'flex' : 'none';
    }
    if (domCache.crtOverlay) {
      domCache.crtOverlay.style.display = settings.scanlines ? 'block' : 'none';
    }

    if (domCache.settingsModal) domCache.settingsModal.classList.add('hidden');
    if (state.running && !state.gameOver) {
      state.paused = false;
      updatePauseBtnIcon();
    }
  }

  // Real-time Settings Event Listeners
  if (domCache.settingInvertY) {
    domCache.settingInvertY.addEventListener('change', () => {
      settings.invertY = domCache.settingInvertY.checked;
      Storage.set('flyby_invert_y', settings.invertY.toString());
      if (domCache.startInvertY) domCache.startInvertY.checked = settings.invertY;
      updateTouchControlsUI();
    });
  }
  if (domCache.startInvertY) {
    domCache.startInvertY.addEventListener('change', () => {
      settings.invertY = domCache.startInvertY.checked;
      Storage.set('flyby_invert_y', settings.invertY.toString());
      if (domCache.settingInvertY) domCache.settingInvertY.checked = settings.invertY;
      updateTouchControlsUI();
    });
  }
  if (domCache.settingPowerups) {
    domCache.settingPowerups.addEventListener('change', () => {
      settings.powerups = domCache.settingPowerups.checked;
      Storage.set('flyby_powerups', settings.powerups.toString());
      if (domCache.startPowerups) domCache.startPowerups.checked = settings.powerups;
      applyPowerupsSetting();
    });
  }
  if (domCache.startPowerups) {
    domCache.startPowerups.addEventListener('change', () => {
      settings.powerups = domCache.startPowerups.checked;
      Storage.set('flyby_powerups', settings.powerups.toString());
      if (domCache.settingPowerups) domCache.settingPowerups.checked = settings.powerups;
      applyPowerupsSetting();
    });
  }
  if (domCache.settingScanlines) {
    domCache.settingScanlines.addEventListener('change', () => {
      settings.scanlines = domCache.settingScanlines.checked;
      Storage.set('flyby_scanlines', settings.scanlines.toString());
      if (domCache.crtOverlay) {
        domCache.crtOverlay.style.display = settings.scanlines ? 'block' : 'none';
      }
    });
  }
  if (domCache.settingInstruments) {
    domCache.settingInstruments.addEventListener('change', () => {
      settings.showInstruments = domCache.settingInstruments.checked;
      Storage.set('flyby_instruments', settings.showInstruments.toString());
      if (domCache.instrumentPanel) {
        domCache.instrumentPanel.style.display = settings.showInstruments ? 'flex' : 'none';
      }
    });
  }
  if (domCache.settingTouchControls) {
    domCache.settingTouchControls.addEventListener('change', () => {
      settings.touchControls = domCache.settingTouchControls.value;
      Storage.set('flyby_touch_controls', settings.touchControls);
      applyTouchControlsVisibility();
    });
  }
  if (domCache.settingEngineSound) {
    domCache.settingEngineSound.addEventListener('change', () => {
      settings.engineSound = domCache.settingEngineSound.checked;
      Storage.set('flyby_engine_sound', settings.engineSound.toString());
      if (masterAudioGain && audioCtx) {
        masterAudioGain.gain.setTargetAtTime(settings.engineSound ? 1.0 : 0.0, audioCtx.currentTime, 0.04);
      }
    });
  }
  if (domCache.settingWind) {
    domCache.settingWind.addEventListener('change', () => {
      settings.wind = domCache.settingWind.checked;
      Storage.set('flyby_wind', settings.wind.toString());
      if (!settings.wind) {
        wind.speed = 0;
        wind.targetSpeed = 0;
      }
    });
  }

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);

  const titleSettingsBtn = document.getElementById('title-settings-btn');
  if (titleSettingsBtn) titleSettingsBtn.addEventListener('click', openSettings);

  const closeSettingsBtn = document.getElementById('close-settings-btn');
  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

  // --- FULLSCREEN MANAGEMENT ---
  function isFullscreenSupported() {
    const el = document.documentElement || document.body;
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled ||
      (el && (el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen))
    );
  }

  function isStandaloneMode() {
    return !!(
      window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    );
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.webkitCurrentFullScreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function updateFullscreenBtnIcon() {
    if (domCache.fullscreenBtn) {
      domCache.fullscreenBtn.textContent = isFullscreen() ? '✕' : '⛶';
      domCache.fullscreenBtn.title = isFullscreen() ? 'Exit Fullscreen (F)' : 'Toggle Fullscreen (F)';
    }
  }

  function toggleFullscreen() {
    if (!isFullscreenSupported()) {
      if (isStandaloneMode()) {
        showStatusBanner('ALREADY IN FULLSCREEN APP MODE', 2.5, 'info');
      } else if (isIOS) {
        showStatusBanner('iOS: TAP SHARE ⎋ → "ADD TO HOME SCREEN" FOR FULLSCREEN', 3.5, 'info');
      } else {
        showStatusBanner('FULLSCREEN NOT SUPPORTED BY THIS BROWSER', 2.5, 'warning');
      }
      return;
    }

    try {
      if (!isFullscreen()) {
        const el = document.documentElement || document.body || document.getElementById('game-wrapper');
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (req) {
          const res = req.call(el, { navigationUI: 'hide' }).catch ? req.call(el, { navigationUI: 'hide' }) : req.call(el);
          if (res && typeof res.then === 'function') {
            res.then(() => {
              updateFullscreenBtnIcon();
              showStatusBanner('FULLSCREEN ENABLED', 1.5, 'info');
              try {
                if (screen.orientation && screen.orientation.lock) {
                  screen.orientation.lock('landscape').catch(() => {});
                }
              } catch (_) {}
            }).catch(() => {
              if (el.requestFullscreen) {
                el.requestFullscreen().then(() => {
                  updateFullscreenBtnIcon();
                  showStatusBanner('FULLSCREEN ENABLED', 1.5, 'info');
                }).catch(() => {
                  showStatusBanner('FULLSCREEN BLOCKED BY BROWSER', 2.0, 'warning');
                });
              } else {
                showStatusBanner('FULLSCREEN BLOCKED BY BROWSER', 2.0, 'warning');
              }
            });
          } else {
            updateFullscreenBtnIcon();
            showStatusBanner('FULLSCREEN ENABLED', 1.5, 'info');
          }
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if (exit) {
          const res = exit.call(document);
          if (res && typeof res.then === 'function') {
            res.then(() => {
              updateFullscreenBtnIcon();
              showStatusBanner('FULLSCREEN EXITED', 1.5, 'info');
              try {
                if (screen.orientation && screen.orientation.unlock) {
                  screen.orientation.unlock();
                }
              } catch (_) {}
            }).catch(() => {});
          } else {
            updateFullscreenBtnIcon();
            showStatusBanner('FULLSCREEN EXITED', 1.5, 'info');
          }
        }
      }
    } catch (_) {
      showStatusBanner('FULLSCREEN NOT AVAILABLE', 2.0, 'warning');
    }
  }

  const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
  fullscreenEvents.forEach((evt) => {
    document.addEventListener(evt, () => {
      updateFullscreenBtnIcon();
      resizeGame();
    });
  });

  if (domCache.fullscreenBtn) {
    domCache.fullscreenBtn.addEventListener('click', (e) => {
      e.preventDefault();
      initAudio();
      toggleFullscreen();
    });
  }

  if (domCache.pauseBtn) {
    domCache.pauseBtn.addEventListener('click', () => {
      initAudio();
      if (state.running && !state.gameOver) {
        state.paused = !state.paused;
        updatePauseBtnIcon();
      }
    });
  }

  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (isMobileDevice && isFullscreenSupported() && !isFullscreen()) {
        toggleFullscreen();
      }
      restartGame();
    });
  }

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      restartGame();
    });
  }

  // Bind On-Screen Touch Controls
  if (domCache.touchBtnUp) {
    bindTouchButton(
      domCache.touchBtnUp,
      () => { touchState.btnUp = true; },
      () => { touchState.btnUp = false; }
    );
  }

  if (domCache.touchBtnDown) {
    bindTouchButton(
      domCache.touchBtnDown,
      () => { touchState.btnDown = true; },
      () => { touchState.btnDown = false; }
    );
  }

  if (domCache.touchBtnThrottle) {
    bindTouchButton(
      domCache.touchBtnThrottle,
      () => { touchState.throttle = true; },
      () => { touchState.throttle = false; }
    );
  }

  if (domCache.touchBtnFire) {
    bindTouchButton(
      domCache.touchBtnFire,
      () => { touchState.btnFire = true; },
      () => { touchState.btnFire = false; }
    );
  }

  // Device orientation hint check
  function checkOrientation() {
    if (!domCache.orientationHint) return;
    const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 850;
    const isTouch = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
    if (isPortrait && isTouch && state.running && !state.gameOver) {
      domCache.orientationHint.classList.remove('hidden');
    } else {
      domCache.orientationHint.classList.add('hidden');
    }
  }

  // Dynamic Game Canvas Resizing
  function resizeGame() {
    const containerWidth = window.innerWidth || document.documentElement.clientWidth || 960;
    const containerHeight = window.innerHeight || document.documentElement.clientHeight || 540;
    const aspect = containerWidth / Math.max(1, containerHeight);
    gameWidth = Math.max(720, Math.round(GAME_HEIGHT * aspect));
    if (canvas.width !== gameWidth || canvas.height !== GAME_HEIGHT) {
      canvas.width = gameWidth;
      canvas.height = GAME_HEIGHT;
    }
    ctx.imageSmoothingEnabled = false;
    checkOrientation();
  }
  window.addEventListener('resize', resizeGame);
  window.addEventListener('orientationchange', resizeGame);

  // Prevent context menus, long-press selection popups, and text selection highlights
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('selectstart', (e) => {
    e.preventDefault();
  });

  // Initial setup
  resizeGame();
  if (domCache.settingInvertY) domCache.settingInvertY.checked = settings.invertY;
  if (domCache.startInvertY) domCache.startInvertY.checked = settings.invertY;
  if (domCache.settingPowerups) domCache.settingPowerups.checked = settings.powerups;
  if (domCache.startPowerups) domCache.startPowerups.checked = settings.powerups;
  if (domCache.settingTouchControls) domCache.settingTouchControls.value = settings.touchControls || 'auto';
  if (domCache.settingInstruments) domCache.settingInstruments.checked = settings.showInstruments;
  if (domCache.settingScanlines) domCache.settingScanlines.checked = settings.scanlines;
  if (domCache.settingEngineSound) domCache.settingEngineSound.checked = settings.engineSound;
  if (domCache.settingWind) domCache.settingWind.checked = settings.wind;

  if (domCache.instrumentPanel) {
    domCache.instrumentPanel.style.display = settings.showInstruments ? 'flex' : 'none';
  }
  if (domCache.crtOverlay) {
    domCache.crtOverlay.style.display = settings.scanlines ? 'block' : 'none';
  }

  updateTouchControlsUI();
  applyTouchControlsVisibility();
  initWorldCourse(1);
  updateHUD();
  requestAnimationFrame(gameLoop);

})();
