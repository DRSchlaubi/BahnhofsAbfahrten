import { createGlobalStyle } from 'styled-components';
import { MapContainer } from 'client/Map/container/MapContainer';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import { useMemo } from 'react';
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import L from 'leaflet';

const GlobalIconStyle = createGlobalStyle`
  .mapIcon {
    filter: hue-rotate(270deg);
  }
`;

export const ActivePolyline = () => {
  const { activePolyline, activeJourney } = MapContainer.useContainer();
  const trainIcon = useMemo(
    () =>
      L.icon({
        iconUrl: icon,
        shadowUrl: iconShadow,
        iconSize: [24, 36],
        iconAnchor: [12, 36],
        className: 'mapIcon',
      }),
    []
  );

  if (!activePolyline || !activeJourney) return null;

  return (
    <>
      <GlobalIconStyle />
      <Polyline color="green" positions={activePolyline.points} />
      {activePolyline.locations.map((l) => (
        <Marker
          icon={trainIcon}
          key={l.id}
          position={[l.coordinates.lat, l.coordinates.lng]}
        >
          <Tooltip permanent>{l.title}</Tooltip>
        </Marker>
      ))}
    </>
  );
};
