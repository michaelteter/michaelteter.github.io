const CONSTS = {
    GAME_BORDER_COLOR: '#808080',
    WALL_COLOR: '#808080',
    BG_COLOR: '#080808',
    UNAVAILABLE_PLACEMENT_COLOR: '#333333',
    EXIT_FLASH_COLOR: '#f2ff00ff',
    EXIT_FLASH_DURATION: 300, // ms
    IMPACT_PARTICLE_MULTIPLIER: 10.0,
    TOWER_SALE_PCT: 0.5,
  SHIPS_PER_WAVE: 10,
  START_MONEY: 100,
  START_LIVES: 10,
  INITIAL_MUSIC_STATE: "off",
  MUSIC_VOLUME: 0.5,
  SFX_VOLUME: 0.8,
  SONGS: [
    "GeometricLinesofDefense_2.mp3",
    "VectorGridDefensive.mp3",
    "ApocalypseDemoRun_2.mp3",
    "GeometricLinesofDefense_1.mp3",
    "NightfallGroove.mp3",
    "VectorLinesLaserMines.mp3"
  ]
};

const SHAPES = {
    // Defined as normalized points (x,y) assuming scale 1
    // Pointing RIGHT (East) as base rotation 0
    triangle: [
        {x: 1, y: 0},
        {x: -0.6, y: 0.7},
        {x: -0.6, y: -0.7}
    ],
    dart: [
        {x: 1, y: 0},
        {x: -1, y: 0.5},
        {x: -0.5, y: 0},
        {x: -1, y: -0.5}
    ],
    trapezoid: [
        {x: -0.8, y: 0.8},  // Top Back
        {x: 0.8, y: 0.4},   // Top Front
        {x: 0.8, y: -0.4},  // Bottom Front
        {x: -0.8, y: -0.8}  // Bottom Back
  ],
    square: [
      {x: 1, y: 1},
      {x: -1, y: 1},
      {x: -1, y: -1},
      {x: 1, y: -1}
  ],
    green_tower: [
      { x: 0.8, y: 0.3 },
      { x: 0.7, y: 0.4 },
      { x: -0.5, y: 0.4 },
      { x: -0.5, y: -0.4 },
      { x: 0.7, y: -0.4 },
      { x: 0.8, y: -0.3 },
      { x: -0.3, y: -0.3 },
      { x: -0.3, y: 0.3 },
    ],
    pentagon: [
        {x: 1, y: 0},
        {x: 0.309, y: 0.951},
        {x: -0.809, y: 0.588},
        {x: -0.809, y: -0.588},
        {x: 0.309, y: -0.951}
  ],
    red_tower: [
      { x: 0.5, y: 0.6 },
      { x: 0.5, y: 0.8 },
      { x: -0.5, y: 0.8 },
      { x: -0.5, y: -0.8 },
      { x: 0.5, y: -0.8 },
      { x: 0.5, y: -0.6 },
      { x: -0.3, y: -0.6 },
      { x: -0.3, y: 0.6 },
    ],
    hexagon: [
        {x: 1, y: 0},
        {x: 0.5, y: 0.866},
        {x: -0.5, y: 0.866},
        {x: -1, y: 0},
        {x: -0.5, y: -0.866},
        {x: 0.5, y: -0.866}
    ],
    three_pointed_star: [
        {x: 1, y: 0},
        {x: -0.2, y: 0.3},
        {x: -0.6, y: 0.9},
        {x: -0.6, y: 0},
        {x: -0.6, y: -0.9},
        {x: -0.2, y: -0.3}
    ],
    asterisk: [
        // 8-point starish shape
        {x: 1, y: 0}, {x: 0.3, y: 0.3},
        {x: 0, y: 1}, {x: -0.3, y: 0.3},
        {x: -1, y: 0}, {x: -0.3, y: -0.3},
        {x: 0, y: -1}, {x: 0.3, y: -0.3}
    ]
};

const TARGETING_MODES = {
  fixed: "maintain current target until it explodes or goes out of range",
  nearest: "always target nearest enemy, changing targets as needed",
  weakest: "target weakest enemy in range, then stay on target until it explodes or goes out of range",
  strongest: "target strongest enemy in range, then stay on target until it explodes or goes out of range",
}

const TOWER_TYPES = {
    purple: {
        name: "Artillary Turret",
        type: "artillary",
        shape: "three_pointed_star",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "sci-fi-launch-3-351238.wav",
        fire_sound_volume: 0.7,
        explode_sound: "",
        explode_sound_volume: 1.0,
        price: 40,
        range: 150,
        cooldown: 1000,
        damage: 150,
        retarget_rotation_rate: 5.0,
        firing_angle_threshold: 0.1, // Radians (~5.7 degrees)
        outlets: [{ x: 0, y: 0, delay: 0 }],
        projectile: { speed: 10, color: '#aa00ff' },
        color: '#aa00ff'
    },
    green: {
        name: "Laser Turret",
        type: "laser",
        shape: "green_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "laser-weld-103309.wav",
        fire_sound_volume: 1.0,
        explode_sound: "",
        explode_sound_volume: 1.0,
        price: 10,
        range: 100,
        cooldown: 0,
        damage: 80,
        retarget_rotation_rate: 5.0,
        firing_angle_threshold: 0.1,
        outlets: [{x:0, y:0, delay:0}],
        shot_duration_ms: 1000,
        firing_pause_ms: 500,
        color: '#00ff66'
    },
    red: {
        name: "Missile Battery",
        type: "projectile",
        shape: "red_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "missile-blast-2-95177.wav",
        fire_sound_volume: 0.8,
        explode_sound: "",
        explode_sound_volume: 1.0,
        price: 20,
        range: 150,
        cooldown: 1500,
        damage: 50,
        retarget_rotation_rate: 5.0,
        firing_angle_threshold: 0.1,
        outlets: [{x:-5, y:0, delay:0}, {x:5, y:0, delay:150}], // Staggered
        projectile: { speed: 6, color: '#ff3333' },
        color: '#ff3333'
    },
    blue: {
        name: "Pulse Disruptor",
        type: "pulse",
        shape: "asterisk",
        targeting_mode: TARGETING_MODES.fixed, // irrelevant for pulse
        fire_sound: "electronic-pulse-8bit-293075.wav",
        fire_sound_volume: 0.5,
        explode_sound: "",
        explode_sound_volume: 1.0,
        price: 30,
        range: 100,
        cooldown: 2000,
        damage: 10,
        effect: { type: 'slow', factor: 0.5, duration: 1000 },
        retarget_rotation_rate: 5.0,
        firing_angle_threshold: 0.1,
        outlets: [{x:0, y:0, delay:0}],
        color: '#33ccff'
    }
};

// Legacy shim if needed by game.js initialization before full refactor
const Towers = {
    greenDamage: TOWER_TYPES.green.damage,
    greenRange: TOWER_TYPES.green.range,
    greenDelay: TOWER_TYPES.green.cooldown,
    greenPrice: TOWER_TYPES.green.price,

    redDamage: TOWER_TYPES.red.damage,
    redRange: TOWER_TYPES.red.range,
    redDelay: TOWER_TYPES.red.cooldown,
    redSpeed: TOWER_TYPES.red.projectile ? TOWER_TYPES.red.projectile.speed : 0,
    redPrice: TOWER_TYPES.red.price,

    blueDamage: TOWER_TYPES.blue.damage,
    blueRadius: TOWER_TYPES.blue.range,
    blueDelay: TOWER_TYPES.blue.cooldown,
    blueSlowFactor: TOWER_TYPES.blue.effect ? TOWER_TYPES.blue.effect.factor : 0,
    blueDuration: TOWER_TYPES.blue.effect ? TOWER_TYPES.blue.effect.duration : 0,
    bluePrice: TOWER_TYPES.blue.price,

    purpleDamage: TOWER_TYPES.purple.damage,
    purpleRange: TOWER_TYPES.purple.range,
    purpleDelay: TOWER_TYPES.purple.cooldown,
    purplePrice: TOWER_TYPES.purple.price
};

const ENEMIES = [
    {
        id: "green",
        name: "Scout",
        hp: 100,
        speed: 100,
        value: 10,
        color: '#00ff66',
        shape: 'triangle',
        draw_scale: 0.8,
        resistance: {
            laser: 1.0,
            projectile: 1.0,
            pulse: 1.0
        }
    },
    {
        id: "orange",
        name: "Runner",
        hp: 60,
        speed: 200,
        value: 15,
        color: '#ffaa00',
        shape: 'dart',
        draw_scale: 0.8,
        resistance: {
            laser: 1.0,
            projectile: 0.8, // Slightly resistant to explosions?
            pulse: 1.0
        }
    },
    {
        id: "purple",
        name: "Tank",
        hp: 200,
        speed: 50,
        value: 40,
        color: '#aa00ff',
      shape: 'trapezoid',
        draw_scale: 1.0,
        resistance: {
            laser: 0.8,
            projectile: 0.2, // Very resistant to explosions
            pulse: 1.0
        }
    }
];

// Compatibility Shim for old GameConfig if not fully refactored yet,
// though we will refactor game.js immediately.
const Enemies = {}; // Deprecated
