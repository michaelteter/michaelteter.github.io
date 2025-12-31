const CONSTS = {
    GAME_BORDER_COLOR: '#808080',
    WALL_COLOR: '#808080',
    BG_COLOR: '#080808',
  UNAVAILABLE_PLACEMENT_COLOR: '#333333',
    EXIT_FLASH_COLOR: '#f2ff00ff',
  EXIT_FLASH_DURATION: 300, // ms
  EXIT_ALARM_SOUND: "vector_assets/audio/greece-eas-alarm-451404.wav",
    EXIT_ALARM_VOLUME: 0.6,
    IMPACT_PARTICLE_MULTIPLIER: 10.0,
    TOWER_SALE_PCT: 0.5,
  SHIPS_PER_GROUP: 10,
  SHIP_SPAWN_GAP_MS: 1000,
  GROUP_SPAWN_GAP_MS: 3000,
  START_MONEY: 100,
  START_LIVES: 10,
  DIFFICULTY_INCREASE_FACTOR: 1.25,
  VALUE_INCREASE_FACTOR: 1.1,
  INITIAL_MUSIC_STATE: "off",
  MUSIC_VOLUME: 0.5,
  SFX_VOLUME: 0.6,
  RANDOM_FIRST_SONG: true,
  SONGS: [
    "vector_assets/audio/ApocalypseDemoRun_2.mp3",
    "vector_assets/audio/GeometricLinesofDefense_1.mp3",
    "vector_assets/audio/MidnightVectorSiege_1.mp3",
    "vector_assets/audio/BossRoomBloodrush.mp3",
    "vector_assets/audio/MidnightSoftCurrents.mp3",
    "vector_assets/audio/TerminalLockdown.mp3",
    "vector_assets/audio/GeometricLinesofDefense_2.mp3",
    "vector_assets/audio/MidnightVectorSiege_2.mp3",
    "vector_assets/audio/NightfallGroove.mp3",
    "vector_assets/audio/VectorRamparts.mp3",
    "vector_assets/audio/VectorGridDefensive.mp3",
    "vector_assets/audio/VectorLinesLaserMines.mp3"
  ],
  SFX_VOL_DOWN_AMOUNT: 0.1,
  SFX_VOL_UP_AMOUNT: 0.1,
  MUSIC_VOL_DOWN_AMOUNT: 0.1,
  MUSIC_VOL_UP_AMOUNT: 0.1
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
    laser_tower: [
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
    missile_tower: [
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
  railgun_tower: [
    { x: -0.7, y: -0.7 },
    { x: 0.0, y: -0.7 },
    { x: 0.2, y: -0.2 },
    { x: 0.8, y: -0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.2 },
    { x: 0.0, y: 0.7 },
    { x: -0.7, y: 0.7 },
    { x: -0.7, y: -0.7 }
  ],
    artillery_tower: [
        {x: 1, y: 0},
        {x: -0.2, y: 0.3},
        {x: -0.6, y: 0.9},
        {x: -0.6, y: 0},
        {x: -0.6, y: -0.9},
        {x: -0.2, y: -0.3}
    ],
    emp_tower: [
        // 8-point starish shape
        {x: 1, y: 0}, {x: 0.3, y: 0.3},
        {x: 0, y: 1}, {x: -0.3, y: 0.3},
        {x: -1, y: 0}, {x: -0.3, y: -0.3},
        {x: 0, y: -1}, {x: 0.3, y: -0.3}
    ]
};

const TARGETING_MODES = {
    nearest: 'nearest',
    weakest: 'weakest',
    strongest: 'strongest',
    fixed: 'fixed'
};

const TOWER_DAMAGE_TYPES = {
    LASER: 'laser',
    EXPLOSIVE: 'explosive',
    ELECTROMAGNETIC: 'electromagnetic',
    HIGH_ENERGY: 'high_energy'
};

const TOWER_TYPES = {
    LASER: 'laser',
    MISSILE: 'missile',
    EMP: 'emp',
    ARTILLERY: 'artillery',
    RAILGUN: 'railgun'
};

const TOWERS = {
    [TOWER_TYPES.RAILGUN]: {
        name: "Railgun",
        type: TOWER_TYPES.RAILGUN,
        damage_type: TOWER_DAMAGE_TYPES.HIGH_ENERGY,
        shape: "railgun_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/sci-fi-launch-3-351238.wav",
        fire_sound_volume: 0.7,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
        explode_sound_volume: 1.0,
        price: 100,
        range: 250, // Detection range
        cooldown: 3000,
        damage: 100,
        retarget_rotation_rate: 0.0, // Fixed direction
        firing_angle_threshold: 0.1,
        outlets: [{ x: 0, y: 0, delay: 0 }],
        color: '#FFFF00'
    },
    [TOWER_TYPES.ARTILLERY]: { // was purple
        name: "Artillery Turret", // Typo fixed
        type: TOWER_TYPES.ARTILLERY,
        damage_type: TOWER_DAMAGE_TYPES.EXPLOSIVE,
        shape: "artillery_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/sci-fi-launch-3-351238.wav",
        fire_sound_volume: 0.7,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
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
    [TOWER_TYPES.LASER]: { // was green
        name: "Laser Turret",
        type: TOWER_TYPES.LASER,
        damage_type: TOWER_DAMAGE_TYPES.LASER,
        shape: "laser_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/laser-weld-103309.wav",
        fire_sound_volume: 1.0,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
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
    [TOWER_TYPES.MISSILE]: { // was red
        name: "Missile Launcher",
        type: TOWER_TYPES.MISSILE,
        damage_type: TOWER_DAMAGE_TYPES.EXPLOSIVE,
        shape: "missile_tower",
        targeting_mode: TARGETING_MODES.fixed,
        fire_sound: "vector_assets/audio/missile-blast-2-95177.wav",
        fire_sound_volume: 0.8,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
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
    [TOWER_TYPES.EMP]: { // was blue
        name: "Pulse Disruptor",
        type: TOWER_TYPES.EMP,
        damage_type: TOWER_DAMAGE_TYPES.ELECTROMAGNETIC,
        shape: "emp_tower",
        targeting_mode: TARGETING_MODES.fixed, // irrelevant for pulse
        fire_sound: "vector_assets/audio/electronic-pulse-8bit-293075.wav",
        fire_sound_volume: 0.5,
        explode_sound: "vector_assets/audio/cinematic-boom-171285.wav",
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



const ENEMIES = [
    {
        id: "green",
        name: "Scout",
        hp: 110,
        speed: 100,
        value: 2,
        explode_sound: "vector_assets/audio/explosion-322491.wav",
        explode_sound_volume: 1.0,
        color: '#00ff66',
        shape: 'triangle',
        draw_scale: 0.8,
        resistance: {
            [TOWER_DAMAGE_TYPES.LASER]: 1.0,
            [TOWER_DAMAGE_TYPES.EXPLOSIVE]: 1.0,
            [TOWER_DAMAGE_TYPES.ELECTROMAGNETIC]: 1.0,
            [TOWER_DAMAGE_TYPES.HIGH_ENERGY]: 1.0
        }
    },
    {
        id: "orange",
        name: "Runner",
        hp: 60,
        speed: 200,
        value: 3,
        explode_sound: "vector_assets/audio/grenade-explosion-14-190266.wav",
        explode_sound_volume: 1.0,
        color: '#ffaa00',
        shape: 'dart',
        draw_scale: 0.8,
        resistance: {
            [TOWER_DAMAGE_TYPES.LASER]: 1.0,
            [TOWER_DAMAGE_TYPES.EXPLOSIVE]: 0.8, // Slightly resistant to explosions?
            [TOWER_DAMAGE_TYPES.ELECTROMAGNETIC]: 1.0,
            [TOWER_DAMAGE_TYPES.HIGH_ENERGY]: 1.0
        }
    },
    {
        id: "purple",
        name: "Tank",
        hp: 320,
        speed: 50,
      value: 3,
                explode_sound: "vector_assets/audio/musket-explosion-6383.wav",
        explode_sound_volume: 1.0,

        color: '#aa00ff',
      shape: 'trapezoid',
        draw_scale: 1.0,
        resistance: {
            [TOWER_DAMAGE_TYPES.LASER]: 0.8,
            [TOWER_DAMAGE_TYPES.EXPLOSIVE]: 0.2, // Very resistant to explosions
            [TOWER_DAMAGE_TYPES.ELECTROMAGNETIC]: 1.0,
            [TOWER_DAMAGE_TYPES.HIGH_ENERGY]: 1.0
        }
    }
];

// Compatibility Shim for old GameConfig if not fully refactored yet,
// though we will refactor game.js immediately.
const Enemies = {}; // Deprecated
