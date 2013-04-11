// see http://lostechies.com/derickbailey/2012/04/17/managing-a-modal-dialog-with-backbone-and-marionette/
var ModalRegion = Backbone.Marionette.Region.extend({
  el: "#modal",

  constructor: function(){
    _.bindAll(this);
    Backbone.Marionette.Region.prototype.constructor.apply(this, arguments);
    this.on("show", this.showModal, this);
  },

  getEl: function(selector){
    var $el = $(selector);
    $el.on("hidden", this.close);
    return $el;
  },

  showModal: function(view){
    view.on("close", this.hideModal, this);
    this.$el.modal('show');
  },

  hideModal: function(){
    this.$el.modal('hide');
  }
});

var AlterMap = new Backbone.Marionette.Application();

AlterMap.currentNetwork = null;
AlterMap.currentNode = null;

AlterMap.addRegions({
  mapRegion: "#map",
  sidebarRegion: "#sidebar",
  sidebarTopRegion: "#sidebar-top",
  sidebarMainRegion: "#sidebar-main",
  toolbarRegion: "#toolbar",
  statusRegion: "#status",
  modalRegion: ModalRegion,
});

////////////////////////////// Models

AlterMap.Network = Backbone.Model.extend({
  url : function() {
    return this.id ? '/networks/' + this.id : '/networks';
  },
  nodeCount: function(){
  },
});

AlterMap.Node = Backbone.Model.extend({
  url : function() {
    // POST to '/nodes' and PUT to '/nodes/:id'
    return this.id ? '/nodes/' + this.id : '/nodes';
  },

  initialize : function(){
    _.bindAll(this, 'isInCurrentNetwork');
  },

  isInCurrentNetwork: function(){
    if (AlterMap.currentNetwork != null){
      if (this.get('network_id') == AlterMap.currentNetwork.id){
        return true;
      }
    }
  },

  /*
    select: function(){
    if (!this.get("selected")){
    this.set({selected: true}, {silent: true});
    this.trigger("selected");
    this.collection.select(this);
    }
    AlterMap.vent.trigger("node:selected", this);
    },

    deselect: function(){
    this.unset("selected", {silent: true});
    this.trigger("deselected");
    }
  */
});

AlterMap.Device = Backbone.Model.extend({
  url : function() {
    return this.id ? '/devices/' + this.id : '/devices';
  },
});

AlterMap.Interface = Backbone.Model.extend({
  url : function() {
    return this.id ? '/interfaces/' + this.id : '/interfaces';
  },
});

AlterMap.WifiLink = Backbone.Model.extend({
  url : function() {
    return this.id ? '/wifilinks/' + this.id : '/wifilinks';
  },
});

////////////////////////////// Collections

AlterMap.NetworkCollection =  Backbone.Collection.extend({
  db : {
    changes : true
  },
  url: "/networks",
  model: AlterMap.Network,

  initialize : function(){
    _.bindAll(this, 'select');
  },

  select: function(network_id){
    var network = AlterMap.networks.where({'_id': network_id})[0];
    AlterMap.currentNetwork = network;
  }
});

AlterMap.NodeCollection =  Backbone.Collection.extend({
  db : {
    changes : true
  },
  url: "/nodes",
  model: AlterMap.Node,

  initialize : function(){
    _.bindAll(this, 'select');
  },

  select: function(node){
    AlterMap.currentNode = node;
  }

});

AlterMap.DeviceCollection =  Backbone.Collection.extend({
  db : {
    changes : true
  },
  url: "/devices",
  model: AlterMap.Device,
});

AlterMap.InterfaceCollection =  Backbone.Collection.extend({
  db : {
    changes : true
  },
  url: "/interfaces",
  model: AlterMap.Interface,
});

AlterMap.WifiLinkCollection =  Backbone.Collection.extend({
  db : {
    changes : true
  },
  url: "/wifilinks",
  model: AlterMap.WifiLink,
});

////////////////////////////// Views 

AlterMap.NetworkOptionView = Backbone.Marionette.ItemView.extend({
  tagName: "option",
  className: "network-option",

  initialize : function(){
    _.bindAll(this, 'render');
  },
  render: function(){
    $(this.el).html(this.model.get('name'));
    $(this.el).attr('value', this.model.id);
  },
})

AlterMap.NetworkSelectView = Backbone.Marionette.CompositeView.extend({
  itemView: AlterMap.NetworkOptionView,
  itemViewContainer: "select",
  events: {
    'change': 'select'
  },
  initialize : function(){
    this.template = _.template($('#network-select').html());
    _.bindAll(this, 'select');
  },
  select: function(){
    network_id = $('#network-select', this.el).val();
    AlterMap.vent.trigger("network:selected", network_id)
  }
});

AlterMap.NetworkToolboxView = Backbone.Marionette.ItemView.extend({
  id: 'network-toolbox',
  className: 'toolbox',
  events: {
    'click #add-node-link': 'addNode'
  },
  initialize : function(){
    this.template = _.template($('#network-toolbox').html());
    _.bindAll(this, 'addNode');
  },
  addNode: function(evt){
//    evt.preventDefault();
    AlterMap.vent.trigger('node:add-new', AlterMap.currentNetwork.id);
  },
  render: function(){
    $(this.el).html(this.template(
      {'network_id': AlterMap.currentNetwork.id,
       'network_name': AlterMap.currentNetwork.get('name')}));
  }
});

AlterMap.NodeRowView = Backbone.Marionette.ItemView.extend({
  tagName: "li",
  className: "node-row",
  events: {
    "click": "selectNode"
  },
  initialize : function(){
    // we load the template here because they aren't ready at page load
    // because we get them through an ajax request
    this.template = _.template($("#node-row-template").html())
    _.bindAll(this, 'selectNode');

  },
  render: function(){
    var content = this.model.toJSON();
    $(this.el).html(this.template(content));
  },
  selectNode: function(evt){
//    evt.preventDefault();
    AlterMap.vent.trigger('node:selected', this.model.id);
  }
})

AlterMap.NodeListView = Backbone.Marionette.CollectionView.extend({
  itemView: AlterMap.NodeRowView,
  tagName: 'ul',
  id: 'nodelist',

  onItemAdded: function(itemView){
    // only show node markers for the currently selected network
    var node = itemView.model
    if (AlterMap.currentNetwork == null || node.isInCurrentNetwork()){
      if(node.get('coords')!=undefined){
        node.marker = AlterMap.Map.displayNodeMarker(node);
      }
      else{
        console.log('unpositioned node '+ node.get('name') +', id: '+ node.id);
      }
    }
  },
  appendHtml: function(collectionView, itemView, index){
    // only show nodes for the currently selected network
    if (AlterMap.currentNetwork == null || itemView.model.isInCurrentNetwork()){
        collectionView.$el.append(itemView.el);
    }
  },
/*
  onItemRemoved: function(itemView){
    AlterMap.Map.removeNodeMarker(itemView.model);
  },
*/
  onClose: function(){
    AlterMap.Map.resetMarkers();
  }
});

AlterMap.NodeAddView = Backbone.Marionette.ItemView.extend({
  className: "modal",
  events: {
    'click #pick-coords': 'pickCoords'
  },

  initialize: function(){
    this.template = _.template($("#node-add-template").html());
    _.bindAll(this, 'pickCoords');
  },
  pickCoords: function(){
    nodeName = $('#new-node-form #node_name').val();
    if (nodeName!=""){
      AlterMap.currentNode = new AlterMap.Node({'name': nodeName, 'network_id': AlterMap.currentNetwork.id});
      this.close();
      AlterMap.Map.drawNodeMarker();
    };
  }
/*
render: function(){
    $(this.el).html(this.template({'network': AlterMap.currentNetwork}));
  }
*/
});

AlterMap.NodeDetailView = Backbone.Marionette.ItemView.extend({
  className: "modal",
  initialize: function(){
    this.template = _.template($("#node-detail-template").html());
  },
  render: function(){
    $(this.el).html(this.template({'node': this.model.toJSON()}));
  },
  onClose: function(){
// TODO: this view is getting instantiated and closed more than once. Need to investigate
//    AlterMap.currentNode = null;
//    AlterMap.Map.unselectNodeMarker(this.model);
  }
});


AlterMap.LinkLineView = Backbone.Marionette.ItemView.extend({
  initialize : function(){
    _.bindAll(this, '_nodeFromMAC');
  },
  _nodeFromMAC: function (macaddr){
    var iface = AlterMap.interfaces.where({'macaddr': macaddr})[0];
    if (iface != undefined ){
      var device = AlterMap.devices.get(iface.get('device_id'));
      var node = AlterMap.nodes.where({'_id': device.get('node_id')})[0]
      return node;
    }
  },

  render: function(){
    var source_node = this._nodeFromMAC(this.model.get('macaddr'));
    var target_node = this._nodeFromMAC(this.model.get('station'));
    if (source_node != undefined && target_node != undefined){
      // only show links for the currently selected network
      if (AlterMap.currentNetwork == null ||
          (source_node.isInCurrentNetwork() || target_node.isInCurrentNetwork())
         ){
        this.model.source_coords = source_node.get('coords');
        this.model.target_coords = target_node.get('coords');
        if (this.model.line == undefined){
          this.model.line = AlterMap.Map.displayLinkLine(this.model);
        }
      }
    }
  },
})

AlterMap.WifiLinksView = Backbone.Marionette.CollectionView.extend({
  itemView: AlterMap.LinkLineView,
/*
  onItemRemoved: function(itemView){
    AlterMap.Map.removeLinkLine(itemView.model);
  },
  onClose: function(){
    AlterMap.Map.resetLinkLines();
  }
*/
});


////////////////////////////// 


AlterMap.selectNetwork = function(network_id){
  AlterMap.networks.select(network_id);
  // a new network has been selected, so we re-render the view
  AlterMap.sidebarMainRegion.close();
  var nodeListView = new AlterMap.NodeListView({
    collection: AlterMap.nodes
  });
  AlterMap.sidebarMainRegion.show(nodeListView);

  AlterMap.Map.resetLinkLines();
  // TODO: this should be refactored to avoid fetching the whole links collection
  AlterMap.wifilinks.fetch();

  AlterMap.Map.zoomToNodes();
  var networkToolboxView = new AlterMap.NetworkToolboxView();
  AlterMap.toolbarRegion.show(networkToolboxView);
}

AlterMap.selectNode = function(node_id){
  var node = AlterMap.nodes.where({'_id': node_id})[0];
  AlterMap.nodes.select(node);
  var nodeDetail = new AlterMap.NodeDetailView({model: node});
  AlterMap.Map.selectNodeMarker(node);
  AlterMap.modalRegion.show(nodeDetail);
}

AlterMap.addNewNode = function(network_id){
  nodeAddView = new AlterMap.NodeAddView();
  AlterMap.modalRegion.show(nodeAddView);
}

AlterMap.saveNodeToCoords = function(node, coords){
  node.set({coords: coords});
  node.save();
  if (node == AlterMap.currentNode){
    AlterMap.currentNode = null;
  }
}

AlterMap.setupCouch = function(db_name){
  Backbone.couch_connector.config.db_name = db_name;
  Backbone.couch_connector.config.ddoc_name = db_name;
  Backbone.couch_connector.config.single_feed = true;
  Backbone.couch_connector.config.global_changes = true;
}

AlterMap.addInitializer(function(options){
  if (options!=undefined){
    var db_name = options.db_name || 'altermap'
  }
  else var db_name = 'altermap';

  AlterMap.setupCouch(db_name);

  // Enables Mustache.js-like templating.
  _.templateSettings = {
    interpolate : /\{\{(.+?)\}\}/g
  }

  AlterMap.networks = new AlterMap.NetworkCollection();
  AlterMap.nodes = new AlterMap.NodeCollection();
  AlterMap.devices = new AlterMap.DeviceCollection();
  AlterMap.interfaces = new AlterMap.InterfaceCollection();
  AlterMap.wifilinks = new AlterMap.WifiLinkCollection();

  var networkSelectView = new AlterMap.NetworkSelectView({collection: AlterMap.networks})
  AlterMap.toolbarRegion.show(networkSelectView);
  var nodeListView = new AlterMap.NodeListView({collection: AlterMap.nodes})
  AlterMap.sidebarMainRegion.show(nodeListView);
  
  AlterMap.wifiLinksView = new AlterMap.WifiLinksView({collection: AlterMap.wifilinks});

  AlterMap.vent.on("network:selected", function(network_id){
    AlterMap.selectNetwork(network_id);
  });

  AlterMap.vent.on("node:selected", function(node_id){
    AlterMap.selectNode(node_id);
  });

  AlterMap.vent.on("node:add-new", function(network_id){
    AlterMap.addNewNode(network_id);
  });

  AlterMap.vent.on("node:coords-picked", function(coords){
    AlterMap.saveNodeToCoords(AlterMap.currentNode, coords);
  });
  
  /*
    AlterMap.nodes.on("add", function(node){
    AlterMap.addNodeMarker(node);
    });

    AlterMap.vent.on("node:selected", function(node){
    AlterMap.showNode(node);
    router.navigate("nodes/" + node.id);
    });
  */

  AlterMap.networks.fetch({success: function(){
    AlterMap.nodes.fetch({success: function(){
      AlterMap.devices.fetch({success: function(){
        AlterMap.interfaces.fetch({success: function(){
          AlterMap.wifilinks.fetch({success: function(){
            AlterMap.Map.zoomToNodes();
          }});
        }});
      }});
    }});
  }});
});

AlterMap.on("initialize:after", function(){
//    Backbone.history.start();
});