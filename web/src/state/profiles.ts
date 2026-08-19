// The app-level software profiles. A software profile spans every connected
// device and can drive features that only exist while Treehouse is running.
// Single source — the Active Profile widget and the device panels' profile bar
// both read it (they used to hardcode the same three names separately).

export interface SoftwareProfile {
  id: string;
  name: string;
}

export const SOFTWARE_PROFILES: SoftwareProfile[] = [
  { id: 'gaming', name: 'Gaming' },
  { id: 'work', name: 'Work' },
  { id: 'silent', name: 'Silent' },
];

export const profileName = (id: string): string =>
  SOFTWARE_PROFILES.find((p) => p.id === id)?.name ?? 'Software';
