import { AddCityModal } from './components/AddCityModal';
import { CityNav } from './components/CityNav';
import { Header } from './components/Header';
import { LeftRail } from './components/LeftRail';
import { MapView } from './components/MapView';
import { ReferencePanel } from './components/ReferencePanel';
import { RightRail } from './components/RightRail';
import { AppProvider } from './store';

export default function App() {
  return (
    <AppProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header />
        <CityNav />
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <LeftRail />
          <MapView />
          <RightRail />
        </div>
      </div>
      <ReferencePanel />
      <AddCityModal />
    </AppProvider>
  );
}
