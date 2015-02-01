// Dependencies
var util = require('util');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var socket = require('socket.io').listen(server);

// Game objects
var Player = require('./entities/player');
var Bomb = require('./entities/bomb');
var Map = require('./entities/map');

// Game Variables
var socket;
var game;
var map;
var players = {};
var bombs = {};

var TILE_SIZE = 40;

var spawnLocations = {
	1: [{x: 2, y: 5}, {x: 13, y: 1}, {x: 2, y: 1}, {x: 12, y: 6}]
};

var updateInterval = 100; // Broadcast updates every 100 ms.

app.use(express.static('client'));
server.listen(process.env.PORT || 8000);

init();

function init() {
	// Begin listening for events.
	setEventHandlers();

	// Start game loop
	setInterval(broadcastingLoop, updateInterval);
};

function setEventHandlers () {
	socket.sockets.on("connection", function(client) {
		util.log("New player has connected: " + client.id);

		client.on("new player", onNewPlayer);

		client.on("move player", onMovePlayer);

		client.on("disconnect", onClientDisconnect);

		client.on("place bomb", onPlaceBomb);

		client.on("register map", onRegisterMap);
	});
};

function onClientDisconnect() {
	util.log("Player has disconnected: " + this.id);

	spawnLocations[1].push(players[this.id].spawnPoint);
	delete players[this.id];

	this.broadcast.emit("remove player", {id: this.id});
};

function onRegisterMap(data) {
	map = new Map(data, TILE_SIZE);

	var test1 = map.hitTest(83, 90);

	util.log(test1.left + ", " + test1.right + ", " + test1.top + ", " + test1.bottom);


	// for(var i = 0; i < map.mapData.length; i++) {
	// 	util.log(map.mapData[i]);
	// }
};

function onNewPlayer(data) {
	// TODO: handle case where you're out of spawn points.
	var spawnPoint = spawnLocations[1].shift();

	// Create new player
	var newPlayer = new Player(spawnPoint.x * TILE_SIZE, spawnPoint.y * TILE_SIZE, 'down', this.id);
	newPlayer.spawnPoint = spawnPoint;

	// Broadcast new player to connected socket clients
	this.broadcast.emit("new player", newPlayer);

	this.emit("assign id", {x: newPlayer.x, y: newPlayer.y, id: this.id});

	// Notify existing players of the new player
	for(var i in players) {
		this.emit("new player", players[i]);
	}

	players[this.id] = newPlayer;
	bombs[this.id] = {};
};

function onMovePlayer(data) {
	var movingPlayer = players[this.id];

	movingPlayer.x = data.x;
	movingPlayer.y = data.y;
	movingPlayer.facing = data.facing;

	// this.broadcast.emit("move player", {id: this.id, x: data.x, y: data.y, facing: data.facing, timestamp: (+new Date())});
};

function onPlaceBomb(data) {
	var bombId = data.id;
	var playerId = this.id;

	var normalizedBombLocation = map.findNearestTileCenter(data.x, data.y);
	bombs[playerId][bombId]= new Bomb(normalizedBombLocation.x, normalizedBombLocation.y, bombId);

	setTimeout(function() {
		var explosions = bombs[playerId][bombId].detonate(map, 2);
		delete bombs[playerId][bombId];		
		util.log("deleting bomb " + bombId);
		socket.sockets.emit("detonate", {explosions: explosions, id: bombId});
	}, 2000);

	socket.sockets.emit("place bomb", {x: normalizedBombLocation.x, y: normalizedBombLocation.y, id: data.id});
};

function broadcastingLoop() {
	for(var i in players) {
		var player = players[i];
		socket.sockets.emit("move player", {id: player.id, x: player.x, y: player.y, facing: player.facing, timestamp: (+new Date())});
	}
};