// Shared audio display labels (NGENUITY wording) — used by the headset canvas
// (mic presets, mic effects) and the microphone canvas (effects presets, the
// SoloCast's effects and input equalizer).
export const MIC_PRESET_LABEL: Record<string, string> = {
  gaming: 'Gaming',
  streaming: 'Streaming',
  podcast: 'Podcast',
  conference: 'Conference',
};

/** Microphone processing effects, by feature id. */
export const MIC_EFFECT_LABEL: Record<string, string> = {
  'noise-reduction': 'AI Noise Reduction',
  compressor: 'Compressor',
  limiter: 'Limiter',
};

/** Input-equalizer presets a microphone applies on the PC. */
export const INPUT_EQ_LABEL: Record<string, string> = {
  'bass-boost': 'Bass Boost',
  'voice-clarity': 'Voice Clarity',
  broadcast: 'Broadcast',
  flat: 'Flat',
};

/** A microphone's pickup patterns, by SKU id. */
export const PATTERN_LABEL: Record<string, string> = {
  cardioid: 'Cardioid',
  omnidirectional: 'Omnidirectional',
  bidirectional: 'Bidirectional',
  stereo: 'Stereo',
};

/** A microphone's ring-light effects, by SKU id. */
export const LIGHT_EFFECT_LABEL: Record<string, string> = {
  solid: 'Solid',
  wave: 'Wave',
  rainbow: 'Rainbow',
  breathing: 'Breathing',
};

/** A headset's auto power-off choices, by SKU id. */
export const POWER_OFF_LABEL: Record<string, string> = {
  '5min': '5 minutes',
  '10min': '10 minutes',
  '20min': '20 minutes',
  '30min': '30 minutes',
  never: 'Never',
};

/** A headset's notification modes, by SKU id. */
export const NOTIFY_LABEL: Record<string, string> = { voice: 'Voice', tone: 'Tone', none: 'None' };
