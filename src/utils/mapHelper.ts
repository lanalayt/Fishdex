// Shared map HTML helpers for web Leaflet maps

const SATELLITE_SCRIPT = `<script>
(function(){
  var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution:'Esri'});
  var street = null;
  map.eachLayer(function(l){ if(l._url && l._url.indexOf('openstreetmap')>-1) street = l; });
  var on = false;
  var b = document.createElement('div');
  b.textContent = 'Satellite';
  b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:rgba(11,17,32,0.9);color:white;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;border:1px solid rgba(255,255,255,0.2)';
  document.body.appendChild(b);
  b.onclick = function(){
    if(on){ map.removeLayer(sat); if(street)street.addTo(map); else L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); b.textContent='Satellite'; }
    else { if(street)map.removeLayer(street); sat.addTo(map); b.textContent='Map View'; }
    on=!on;
  };
})();
</script>`;

export function addSatelliteToggle(html: string): string {
  return html.replace('</body>', SATELLITE_SCRIPT + '</body>');
}
