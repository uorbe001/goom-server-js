var AIWorld = require("goom-ai-js").World, PhysicsWorld = require("goom-physics-js").World, Gravity = require("goom-physics-js").Gravity;

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
	@property {json} clientConfig a world config used to populate the client worlds.
	@exports Server
*/
function Server(config, broadcast_callback, sendto_callback) {
	this.broadcastCallback = broadcast_callback;
	this.sendToCallback = sendto_callback;
	this.incomingEvents = [], this.outgoingEvents = [];
	this.lastUpdate = 0;
	this.clientConfig = this.__createClientConfig(config);

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

	var gravity_generator;
	//Register gravity
	if (config.level.force_generators.gravity !== undefined) {
		gravity_generator = new Gravity(config.level.force_generators.gravity.force);

		for (i = 0, len = config.level.force_generators.gravity.affected_bodies.length; i < len; i++) {
			body = this.physicsWorld.findBody(config.level.force_generators.gravity.affected_bodies[i]);

			if (body !== null) {
				this.physicsWorld.registerBodyAffectedByForceGenerator(body, gravity_generator);
			}
		}
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
				this.outgoingEvents.push({"type": "init", "config": this.clientConfig, "to": event.from});
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

	//don't send update event when there isn't any updates.
	if (update_event.bodies.length !== 0) this.outgoingEvents.push(update_event);
	
	//Send the outgoing events to the clients.
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

/**
	@inner Creates a clientConfig file from the server config.
	@param {json} config Server config.
	@returns client config
*/
Server.prototype.__createClientConfig = function(config) {
	var c = {};
	c.level = {};
	c.level.model_instances = [];
	c.level.cameras = [];
	var objModelToRenderModel = {}, instance, inst_description;

	for (var i = 0, len = config.agent_models.length; i < len; i++) {
		objModelToRenderModel[config.agent_models[i].name] = config.agent_models[i].appearance.model;
	}

	for (i = 0, len = config.object_models.length; i < len; i++) {
		objModelToRenderModel[config.object_models[i].name] = config.object_models[i].appearance.model;
	}

	for (i = 0, len = config.level.cameras.length; i < len; i++) {
		c.level.cameras.push(JSON.parse(JSON.stringify(config.level.cameras[i])));
	}

	for (i = 0, len = config.level.agents.length; i < len; i++) {
		instance = {};
		inst_description = config.level.agents[i];
		instance.id = inst_description.id;
		instance.model = objModelToRenderModel[inst_description.model];
		if (inst_description.position) instance.position = JSON.parse(JSON.stringify(inst_description.position));
		if (inst_description.orientation) instance.orientation = JSON.parse(JSON.stringify(inst_description.orientation));
		c.level.model_instances.push(instance);
	}

	for (i = 0, len = config.level.objects.length; i < len; i++) {
		instance = {};
		inst_description = config.level.objects[i];
		instance.id = inst_description.id;
		instance.model = objModelToRenderModel[inst_description.model];
		if (inst_description.position) instance.position = JSON.parse(JSON.stringify(inst_description.position));
		if (inst_description.orientation) instance.orientation = JSON.parse(JSON.stringify(inst_description.orientation));
		c.level.model_instances.push(instance);
	}

	//TODO lights & cameras
	c.render_models = JSON.parse(JSON.stringify(config.render_models));

	return c;
};

module.exports = Server;