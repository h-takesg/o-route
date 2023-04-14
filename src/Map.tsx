import { LatLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, ImageOverlay } from 'react-leaflet'

function Map() {
  const bounds = new LatLngBounds([0,0],[1489/16,2560/8])
  return (
    <MapContainer center={[0,0]} zoom={1} scrollWheelZoom style={{height: "100vh"}}>
        <ImageOverlay
          url='samplemap.jpg'
          bounds={bounds}
          opacity={1}
          zIndex={1}
        />
    </MapContainer>
  )
}

export default Map
