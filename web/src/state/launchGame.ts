import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaytimeOptional } from './Playtime';
import { useProfilesOptional } from './Profiles';

/**
 * Launch a game — the ONE way, wherever Play is pressed (TH-484): the Play
 * hero, a My Games tile, a tile's menu, Nova's Resume. Three things, always
 * together:
 *   · the profile linked to the game applies (the Game Link rule, TH-478);
 *   · the playtime clock starts (what the refund agent watches);
 *   · Play opens on the game, its slide held, "Now playing" shown.
 *
 * Until this existed only the hero's Play started the clock, so pressing Play
 * on a library tile — the obvious place — left the refund warning waiting for
 * a session that never began (Chris, 2026-10-20).
 */
export function useLaunchGame(): (gameId: string) => void {
  const profiles = useProfilesOptional();
  const playtime = usePlaytimeOptional();
  const navigate = useNavigate();
  return useCallback(
    (gameId: string) => {
      profiles?.gameLaunched(gameId);
      playtime?.launch(gameId);
      navigate(`/play?playing=${encodeURIComponent(gameId)}`);
    },
    [profiles, playtime, navigate],
  );
}
