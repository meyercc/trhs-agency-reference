import { ReorderableSections, type ReorderableSectionData } from '../components';
import { PlayHero } from './PlayHero';
import { JumpBackIn } from './JumpBackIn';
import { FeaturedRecent } from './FeaturedRecent';
import { PlayLibrary } from './PlayLibrary';
import { SectionHeader } from './SectionHeader';
import { GallerySection } from './GallerySection';
import { useModules } from '../state/Modules';
import { useSettings } from '../state/Settings';
import './pages.css';
import './play.css';

export function Play() {
  const { has } = useModules();
  // Two tops for this page, chosen in Admin → Play layout. The hero is fixed and
  // full-bleed (and carries its own scroll spacer); "Jump Back In" is an ordinary
  // in-flow section, so it goes INSIDE `.play-inner` and the page takes over the
  // top spacing the spacer used to provide.
  const { playLayout } = useSettings();
  const jumpBack = playLayout === 'jumpback';
  // Featured (TH-506): the most recent game as a wide lead tile, then three covers.
  const featured = playLayout === 'featured';
  const noHero = jumpBack || featured;
  // Library, plus the Gallery when the `gallery` module is installed. Two+
  // sections become drag-reorderable (the grip stays hidden with only one).
  const sections: ReorderableSectionData[] = [
    // The library draws its own header (its count is its state), so it takes the grip.
    { id: 'library', headerInChildren: true, children: <PlayLibrary /> },
    ...(has('gallery')
      ? [{ id: 'gallery', header: <SectionHeader label="Gallery" />, children: <GallerySection /> }]
      : []),
  ];

  return (
    <div className="play-page">
      {!noHero && <PlayHero />}
      <div className={'play-inner' + (noHero ? ' no-hero' : '')}>
        {jumpBack && <JumpBackIn />}
        {featured && <FeaturedRecent />}
        <ReorderableSections sections={sections} storageKey="play-sections" />
      </div>
    </div>
  );
}
