import { Avatar, type AvatarProps } from '../components';
import { useSettings } from '../state/Settings';
import { profileImageSrc } from '../app/profileImage';
import type { Profile } from '../state/Profiles';

/**
 * A profile's photo, wherever the profile is named — the switcher, its menu,
 * the Profiles modal's rail, the profile cards. The design system's `Avatar`
 * (`custom`, cover-filling) at its default 24px, resolving the profile's
 * `image` against the theme so a wallpaper photo matches the desk.
 *
 * Decorative by default: the name is always beside it, so the photo carries no
 * accessible name of its own unless the caller gives it one.
 */
export function ProfileAvatar({ profile, ...rest }: { profile: Pick<Profile, 'image' | 'name'> } & Omit<AvatarProps, 'variant' | 'src'>) {
  const { isLight } = useSettings();
  return <Avatar variant="custom" src={profileImageSrc(profile.image, isLight)} alt="" {...rest} />;
}
