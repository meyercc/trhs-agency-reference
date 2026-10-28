import { Avatar } from '../components';
import { useSettings } from '../state/Settings';
import { useStoredImage } from '../state/imageStore';
import { AVATAR_PRESETS, CUSTOM_WALLPAPER_ID, wallpaperImage } from './wallpapers';

/** The src the current avatar choice resolves to. */
export function useAvatarSrc(): string | undefined {
  const { avatar, wallpaper, isLight } = useSettings();
  const upload = useStoredImage('avatar');
  const wpUpload = useStoredImage('wallpaper');
  if (avatar.kind === 'upload') return upload ?? AVATAR_PRESETS[0].img;
  if (avatar.kind === 'wallpaper') return wallpaper === CUSTOM_WALLPAPER_ID ? wpUpload : wallpaperImage(wallpaper, isLight);
  return AVATAR_PRESETS.find((p) => p.id === avatar.id)?.img ?? AVATAR_PRESETS[0].img;
}

/** The signed-in user's avatar, wherever it appears (nav, menu, Profile). */
export function UserAvatar({ size }: { size: number }) {
  return <Avatar variant="custom" src={useAvatarSrc()} alt="" size={size} />;
}
