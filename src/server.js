var AIWorld = require("goom-ai").World, PhysicsWorld = require("goom-physics").World;

/**
	Creates a new Server.
	@class Server is used to handle the server.
	@param {json} config The configuration of the server.
	@param {Function} broadcast_callback The function to be called in order to broadcast events or world updates to the clients.
	@property {Goom.AI.World} aiWorld An AI world instance.
	@property {Goom.Physics.World} physicsWorld A physics world instance.
	@property {Array} incomingEvents The events the server has received and not yet processed.
	@property {Array} outgoingEvents The events the server needs to send to the clients in orther to update them.
	@property {Function} broadcastCallback The function to be called in order to broadcast events or world updates to the clients.
	@exports Server
*/
function Server(config, broadcast_callback) {
	this.broadcastCallback = broadcast_callback;
	this.incomingEvents = [], this.outgoingEvents = [];

	this.aiWorld = new AIWorld(config);
	this.physicsWorld = new PhysicsWorld();

	var physics_models = {};
	for (var i = 0, len = config.object_models.length; i < len; i++) {
		physics_models[config.object_models[i].name] = config.object_models[i];
	}

	var key, obj, model, agent, body;
	for (i = 0, len = config.level.objects.length; i < len; i++) {
		obj = JSON.parse(JSON.stringify(config.level.objects[i]));
		model = physics_models[config.level.objects[i].model];
		for (key in model.body) obj[key] = JSON.parse(JSON.stringify(model.body[key]));
		this.physicsWorld.addBody(obj);
	}

	var update_agent = function(agent, physic_object) {
		agent.position.set(physic_object.position);
		agent.orientation.set(physic_object.orientation);
	};

	for (i = 0, len = config.level.agents.length; i < len; i++) {
		obj = JSON.parse(JSON.stringify(config.level.agents[i]));
		model = this.aiWorld.agentModels[config.level.agents[i].model];
		for (key in model.body) obj[key] = JSON.parse(JSON.stringify(model.body[key]));

		body = this.physicsWorld.addBody(obj);
		agent = this.aiWorld.findInstance(obj.id);
		body.listenToUpdates(agent, update_agent);
	}
}

/**
	Stores an event as a received event in the server.
	@param {json} event The event to be received and parsed on the next update cycle.
*/
Server.prototype.receiveEvent = function(event) {
	this.incomingEvents.push(event);
};

/*
	Updates the worlds in the server, updating both physics and AI.
	@param {Number} time The time to step the simulations forward.
*/
Server.prototype.update = function(time) {
	//TODO: process incoming events
	this.incomingEvents.length = 0;

	this.aiWorld.update(time);
	this.physicsWorld.update(time);
	
	for (var i = this.outgoingEvents.length - 1; i >= 0; i--) {
		this.broadcastCallback(this.outgoingEvents[i]);
	}

	this.outgoingEvents.length = 0;
};

module.exports = Server;