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
