AlterMap.Map = {
  _map: null,
  draw: function(){
    this._map = new OpenLayers.Map('map', {
      projection: new OpenLayers.Projection("EPSG:900913"),
      displayProjection: new OpenLayers.Projection("EPSG:4326"),
    });
    var map_layers = [ new OpenLayers.Layer.OSM("OpenStreetMap", null, {numZoomLevels: 23}),
                   new OpenLayers.Layer.Google(
                     "Google Hybrid",
                     {type: google.maps.MapTypeId.HYBRID, numZoomLevels: 20}
                   )
                 ]
    this._map.addLayers(map_layers);


    this.nodesLayer = new OpenLayers.Layer.Vector(
      "Nodes", {
        eventListeners: {
          'featureselected': function(evt){
            var marker = evt.feature;
            var node = marker.node;
            AlterMap.vent.trigger('node:selected', node.id);
          },
          'featureunselected': function(evt){
          },
          'scope': this,
        }
      })

    this._map.addLayer(this.nodesLayer);

    this.wifiLinksLayer = new OpenLayers.Layer.Vector(
      "WifiLinks",
      {
        styleMap: new OpenLayers.StyleMap({'default':{
          strokeColor: "#0F0",
          fillColor: "#55ff00",
          pointRadius: 6,
          pointerEvents: "visiblePainted",
        }})
      });
    this._map.addLayer(this.wifiLinksLayer);

    this.selector = new OpenLayers.Control.SelectFeature(
      [this.nodesLayer, this.wifiLinksLayer],
      {geometryTypes: ['OpenLayers.Geometry.LineString',
                       'OpenLayers.Geometry.Point']},
      {clickout: true, toggle: true, multiple: false, hover: false}
    );
    this._map.addControl(this.selector);
    this.selector.activate();

    this._map.nodeDraw = new OpenLayers.Control.DrawFeature(
      this.nodesLayer, OpenLayers.Handler.Point)
    this._map.nodeDraw.featureAdded = this._positionNodeMarker
    this._map.addControl(this._map.nodeDraw);

    this._map.addControl(new OpenLayers.Control.MousePosition());
    this._map.addControl(new OpenLayers.Control.LayerSwitcher());
  },

  createNodeMarker: function(node){
    var coords = node.get('coords');
    var point = new OpenLayers.Geometry.Point(coords.lon, coords.lat).transform(
      this._map.displayProjection, this._map.projection);
    var marker = new OpenLayers.Feature.Vector(point);
    marker.node = node;
    marker.attributes['name'] = node.get('name');
    marker.attributes['description'] = '';
    this.nodesLayer.addFeatures([marker]);
    return marker
  },

  removeNodeMarker: function(node){
    this.nodesLayer.removeFeatures(node.marker, {silent: false});
  },

  drawNodeMarker: function(){
    this._map.nodeDraw.activate();
  },

  _positionNodeMarker: function(feature){
    var map = feature.layer.map;
    var mouse_coords = feature.geometry.getBounds().getCenterLonLat()
    coords = mouse_coords.transform(map.projection,
                                    map.displayProjection);
    map.nodeDraw.deactivate();
    // a feature will be drawn when the node is saved
    feature.destroy();
    delete feature;
    AlterMap.vent.trigger('node:coords-picked', coords)
  },

  selectNodeMarker: function(node){
    if (this.nodesLayer.selectedFeatures.indexOf(node.marker)<0){
      this.selector.unselectAll();
      this.selector.select(node.marker);
    }
    var center = node.marker.geometry.getBounds().getCenterLonLat()
    this._map.setCenter(center);
  },
  
  unselectNodeMarker: function(node){
      this.selector.unselect(node.marker);
  },
  resetMarkers: function(){
    this.nodesLayer.removeAllFeatures();
  },

  displayLinkLine: function(link){
    this.wifiLinksLayer.addFeatures([link.line]);
  },
  createLinkLine: function(link){
    var source_point = new OpenLayers.Geometry.Point(
      link.source_coords.lon, link.source_coords.lat).transform(
        this._map.displayProjection, this._map.projection);
    var target_point = new OpenLayers.Geometry.Point(
      link.target_coords.lon, link.target_coords.lat).transform(
        this._map.displayProjection, this._map.projection);
    var linestring = new OpenLayers.Geometry.LineString([source_point, target_point]);
    var line = new OpenLayers.Feature.Vector(linestring);
    var signal = parseFloat(link.attributes.signal);
    if (signal >= -65){
// over -65, we consider the link to already be good
      signal_factor = 1;
    }
// under -85 we will consider it a bad link
    else if (signal < -85){
      signal_factor = 0.2;
    }
    else{
      signal_factor = ((85 + signal) / (85 - 65) * (1 - 0.2) ) + 0.2;
    }
    line.style = {strokeColor: "#0F0", strokeWidth: 3, strokeOpacity: signal_factor/2};
//    line.attributes['name'] = link.attributes.local_mac +", "+ link.attributes.station_mac;
//    line.attributes['description'] = 'channel: '+ link.attributes.channel +', signal: '+ link.attributes.signal
    this.wifiLinksLayer.addFeatures([line]);
    line.link = link;
    return line
  }, 

  removeLinkLine: function(line){
// unselect in case the line was selected
    this.selector.unselectAll();
    line.destroy();
    this.wifiLinksLayer.removeFeatures(line, {silent: false});
//    delete line;
  },

  resetLinkLines: function(){
    this.wifiLinksLayer.removeAllFeatures();
  },

  destroy: function(){
    this._map.destroy();
  },

  zoomToNodes: function(){
    if (this.nodesLayer.features.length>=1){
      this._map.zoomToExtent(this.nodesLayer.getDataExtent());
    }
  },

  getKMLdata: function(){
    var kmlFormat = new OpenLayers.Format.KML({
      'maxDepth':10,
      'extractStyles':true,
      'internalProjection': this._map.projection,
      'externalProjection': new OpenLayers.Projection("EPSG:4326"),
      'foldersName': 'AlterMap KML export',
      'foldersDesc': '', 
    })
    return kmlFormat.write(this.nodesLayer.features.concat(this.wifiLinksLayer.features))
  }
}

