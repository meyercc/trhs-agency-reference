import { ReorderableSections, type ReorderableSectionData } from '../components';
import { PlayHero } from './PlayHero';
import { PlayLibrary } from './PlayLibrary';
import { SectionHeader } from './SectionHeader';
import { GallerySection } from './GallerySection';
import { useModules } from '../state/Modules';
import './pages.css';
import './play.css';

export function Play() {
  const { has } = useModules();
  // Library, plus the Gallery when the `gallery` module is installed. Two+
  // sections become drag-reorderable (the grip stays hidden with only one).
  const sections: ReorderableSectionData[] = [
    { id: 'library', children: <PlayLibrary /> },
    ...(has('gallery')
      ? [{ id: 'gallery', header: <SectionHeader label="Gallery" />, children: <GallerySection /> }]
      : []),
  ];

  return (
    <div className="play-page">
      <PlayHero />
      <div className="play-inner">
        <ReorderableSections sections={sections} storageKey="play-sections" />
      </div>
    </div>
  );
}
