// Art for the "Add Equalizer Preset" chooser: a still of each editor and the
// title's gradient fill, exported from the Figma frame (Audio 7364:454142) and
// committed under Assets/eq so they ship with content-hashed URLs like the
// device heroes and wallpapers do.
const IMGS = import.meta.glob('../../../Assets/eq/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const img = (file: string): string => {
  const key = Object.keys(IMGS).find((k) => k.endsWith('/' + file));
  return key ? IMGS[key] : '';
};

export const EQ_ART = {
  simple: img('simple-eq.png'),
  advanced: img('advanced-eq.png'),
  titleGradient: img('title-gradient.png'),
};
