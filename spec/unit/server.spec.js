var Server = require("../../src/server"), Responses = require("goom-ai-js").Responses;

describe("Server", function(){
	beforeEach(function() {
		this.a1 = function() { return Responses.SUCCESS; };
		spyOn(this, 'a1').andCallThrough();

		var config = {
			"render_models": {
				"box": "assets/box.wglmodel",
				"robot_arm": "assets/robot_arm.wglmodel"
			},

			"agent_models": [
				{
					"name": "box_agent",
					"behaviour": { "type": "action", "execute": this.a1 },
					"movement": {
						"type": "walk",
						"velocity": 12,
						"angular_velocity": 10
					},
					"body": {
						"max_health": 100,
						"max_energy": 100,
						"weight": 1,
						"inertial_tensor": [1/12, 1/12, 1/12],
						"primitives": [
							{
								"type": "box",
								"halfSize": {"x": 1, "y": 1, "z": 1},
								"offset":  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
							}
						]
					},
					"appearance": {
						"model": "box"
					}
				}
			],

			"object_models": [
				{
					"name": "box_obj",
					"body": {
						"weight": 1,
						"inertial_tensor": [1/12, 1/12, 1/12],
						"primitives": [
							{
								"type": "box",
								"halfSize": {"x": 1, "y": 1, "z": 1},
								"offset":  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
							}
						]
					},
					"appearance": {
						"model": "box"
					}
				}
			],

			"level": {
				"cameras": [
					{
						"id": "camera0",
						"position": {"x": 0, "y": 0, "z": -75},
						"target": {"x": 0, "y": 0, "z": 0},
						"active": true
					}
				],

				"navigation_mesh": {
					"triangles": [
						{ "vertices": [0,0,0, 0,0,1, 1,0,1] },
						{ "vertices": [0,0,0, 1,0,1, 2,0,0] },
						{ "vertices": [2,0,0, 1,0,1, 2,0,2] },
						{ "vertices": [2,0,0, 2,0,2, 3,0,1] },
						{ "vertices": [2,0,0, 3,0,1, 4,0,0] },
						{ "vertices": [3,0,1, 4,0,2, 4,0,0] },
						{ "vertices": [2,0,0, 4,0,0, 3,0,-1] },
						{ "vertices": [2,0,0, 3,0,-1, 2,0,-2] },
						{ "vertices": [2,0,-2, 3,0,-1, 4,0,-2] }
					]
				},

				"force_generators": {
					"gravity": {
						"force": {"x": 0, "y": -10, "z": 0},
						"affected_bodies": ["0", "1"]
					}
				},

				"agents": [
					{
						"id": "0",
						"model": "box_agent",
						"static": false,
						"position": {"x": 0, "y": 0, "z": 0},
						"orientation": {"r": 1, "i": 0, "j": 0, "k": 0},
						"health": 100,
						"energy": 80
					}
				],

				"objects": [
					{
						"id": "1",
						"model": "box_obj",
						"static": true,
						"position": {"x": 0, "y": 0, "z": 0},
						"orientation": {"r": 1, "i": 0, "j": 0, "k": 0}
					}
				]
			}
		};

		this.outEvents = [];
		var that = this;
		var broadcast = function(event) { that.outEvents.push(event); };
		var sendTo = function(event, id) { that.outEvents.push(event); };
		this.server = new Server(config, broadcast, sendTo);
	});

	it("server should be create the world(s) correctly", function() {
		expect(this.server.aiWorld.agentModels["box_agent"]).not.toBeNull();
		expect(this.server.aiWorld.agentModels["box_agent"].movement.velocity).toBe(12);
		expect(this.server.aiWorld.agentModels["box_agent"].movement.angular_velocity).toBe(10);
		expect(this.server.aiWorld.agentModels["box_agent"].body.max_health).toBe(100);
		expect(this.server.aiWorld.agentModels["box_agent"].appearance.model).toEqual("box");
		expect(this.server.aiWorld.agentModels["box_agent"].navigationMesh).toBe(this.server.aiWorld.navigationMesh);

		expect(this.server.aiWorld.agents.length).toBe(1);
		expect(this.server.aiWorld.agents[0].position.x).toBe(0);
		expect(this.server.aiWorld.agents[0].orientation.r).toBe(1);
		expect(this.server.aiWorld.agents[0].health).toBe(100);

		expect(this.server.aiWorld.navigationMesh === undefined || this.server.aiWorld.navigationMesh === null).not.toBeTruthy();

		expect(this.server.physicsWorld.rigidBodies.length).toBe(2);
		expect(this.server.physicsWorld.findBody("0").listeners.length).toBe(1);
		expect(this.server.physicsWorld.findBody("0").listeners[0]).toBe(this.server.aiWorld.findInstance("0"));
		expect(this.server.physicsWorld.registry.registrations.length).toBe(2);
	});

	it("should receive to client events", function() {
		this.server.receiveEvent({type: "fire", target: "megaboss", from: "player1"});
		expect(this.server.incomingEvents.length).toBe(1);
	});

	xit("should change the world according to the received events", function() { //TODO
		this.server.receiveEvent({type: "fire", target: "megaboss", from: "player2"});
		this.server.update();
		expect(this.server.incomingEvents.length).toBe(0);
		expect(this.outEvents.length).toBeGreaterThan(0);
	});

	it("should create the client config correctly", function() {
		expect(this.server.clientConfig.render_models.box).toEqual("assets/box.wglmodel");
		expect(this.server.clientConfig.render_models.robot_arm).toEqual("assets/robot_arm.wglmodel");
		expect(this.server.clientConfig.level.model_instances.length).toBe(2);
		expect(this.server.clientConfig.level.model_instances[0].model).toEqual("box");
		expect(this.server.clientConfig.level.model_instances[0].position.x).toBe(0);
		expect(this.server.clientConfig.level.model_instances[0].orientation.r).toBe(1);
		expect(this.server.clientConfig.level.model_instances[0].id).toEqual("0");
		expect(this.server.clientConfig.level.model_instances[1].model).toEqual("box");
		expect(this.server.clientConfig.level.model_instances[1].position.x).toBe(0);
		expect(this.server.clientConfig.level.model_instances[1].orientation.r).toBe(1);
		expect(this.server.clientConfig.level.model_instances[1].id).toEqual("1");
	});
});