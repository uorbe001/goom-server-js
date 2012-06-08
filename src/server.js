var AIWorld = require("goom-ai-js").World, PhysicsWorld = require("goom-physics-js").World;

/**
	Creates a new Server.
	@class Server is used to handle the server.
	@param {json} config The configuration of the server.
	@param {Function} broadcast_callback The function to be called in order to broadcast events or world updates to the clients.
	@property {Goom.AI.World} aiWorld An AI world instance.
	@property {Goom.Physics.World} physicsWorld A physics world instance.
	@property {Array} incomingEvents The events the server has received and not yet processed.
	@property {Array} outgoingEvents The events the server needs to send to the clients in orther to update them.
	@property {Function} broadcastCallback The function to be called in order to broadcast events or world updates to all the clients.
	@property {Function} sendToCallback The function to be called in order to broadcast events or world updates to the clients.
	@property {Number} lastUpdate Time of the last update.
	@property {json} config a copy of the serever configuration used to tell clients how to populate the world.
	@exports Server
*/
function Server(config, broadcast_callback, sendto_callback) {
	this.broadcastCallback = broadcast_callback;
	this.sendToCallback = sendto_callback;
	this.incomingEvents = [], this.outgoingEvents = [];
	this.lastUpdate = 0;
	this.config = config;

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
*/
Server.prototype.update = function() {
	var now = new Date(), elapsed_time = now - this.lastUpdate, event;
	//TODO: process incoming events
	for (var i = 0, len = this.incomingEvents.length; i < len; i++) {
		event = this.incomingEvents[i];
		switch (event.type) {
			case "connection":
				this.outgoingEvents.push({"type": "init", "config": this.config, "to": event.from});
				break;
			default: break;
		}
	}

	this.incomingEvents.length = 0;

	this.aiWorld.update(elapsed_time);
	this.physicsWorld.update(elapsed_time);

	var bodies = this.physicsWorld.rigidBodies, body, update_event = {"type": "update_world", "bodies": []};
	for (i = bodies.length - 1; i >= 0; i--) {
		body = bodies[i];
		//no need to update the body data to the clients if it is unchanged.
		if (!body.isDirty) continue;
		update_event.bodies.push({ "id": body.id, "position": {"x": body.position.x, "y": body.position.y, "z": body.position.z},
			"orientation": {"r": body.orientation.r, "i": body.orientation.i, "j": body.orientation.j, "k": body.orientation.k}});
	}
	this.outgoingEvents.push(update_event);
	
	//Broadcast the outgoing events to the clients.
	for (i = this.outgoingEvents.length - 1; i >= 0; i--) {
		if (this.outgoingEvents[i].to) {
			this.sendToCallback(this.outgoingEvents[i], this.outgoingEvents[i].to);
			continue;
		}
		//If it doesn't go to a singular client it goes to all the clients
		this.broadcastCallback(this.outgoingEvents[i]);
	}

	this.outgoingEvents.length = 0;
	this.lastUpdate = now;
};

module.exports = Server;