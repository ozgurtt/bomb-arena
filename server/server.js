// Dependencies
var express = require("express");
var app = express();
var server = require("http").Server(app);

// Figure out what to do about these globals.
socket = require("socket.io").listen(server);
TILE_SIZE = 40;

// Game objects
var Player = require("./entities/player");
var Bomb = require("./entities/bomb");
var Map = require("./entities/map");
var MapInfo = require("./metadata/map_info");
var Game = require("./entities/game");
var Lobby = require("./lobby");
var PendingGame = require("./entities/pending_game");

var games = {};

var updateInterval = 100; // Broadcast updates every 100 ms.

// Serve up index.html.
app.use(express.static("client"));
server.listen(process.env.PORT || 8000);

init();

function init() {
	Lobby.initialize();

	// Begin listening for events.
	setEventHandlers();

	// Start game loop
	setInterval(broadcastingLoop, updateInterval);
};

function setEventHandlers () {
	socket.sockets.on("connection", function(client) {
		console.log("New player has connected: " + client.id);

		client.on("move player", onMovePlayer);
		client.on("disconnect", onClientDisconnect);
		client.on("place bomb", onPlaceBomb);
		client.on("register map", onRegisterMap);
		client.on("start game on server", onStartGame);

		client.on("enter lobby", Lobby.onEnterLobby);
		client.on("host game", Lobby.onHostGame);
		client.on("select stage", Lobby.onStageSelect);
		client.on("enter pending game", Lobby.onEnterPendingGame);
		client.on("leave pending game", Lobby.onLeavePendingGame);
	});
};

function onClientDisconnect() {
	if (this.gameId == null) {
		return;
	}

	var lobbySlots = Lobby.getLobbySlots();

	if (lobbySlots[this.gameId].state == "joinable" || lobbySlots[this.gameId].state == "full") {
		leavePendingGame.call(this);
	} else if (lobbySlots[this.gameId].state == "settingup") {
		lobbySlots[this.gameId].state = "empty";

		Lobby.broadcastSlotStateUpdate(this.gameId, "empty");
	} else if(lobbySlots[this.gameId].state == "inprogress") {
		var game = games[this.gameId];
	
		if(this.id in game.players) {
			delete game.players[this.id];
	
			socket.sockets.emit("remove player", {id: this.id});	
		}

		if(Object.keys(game.players).length == 0) {
			delete games[this.gameId];

			lobbySlots[this.gameId] = new PendingGame();

			Lobby.broadcastSlotStateUpdate(this.gameId, "empty");
		}
	}
};

function onStartGame() {
	var lobbySlots = Lobby.getLobbySlots();

	var game = new Game();
	games[this.gameId] = game;
	var pendingGame = lobbySlots[this.gameId];
	lobbySlots[this.gameId].state = "inprogress";

	Lobby.broadcastSlotStateUpdate(this.gameId, "inprogress");

	beginRound(pendingGame.playerIds, pendingGame.mapName, game);

	socket.sockets.in(this.gameId).emit("start game on client", {mapName: pendingGame.mapName, players: game.players});
};

function beginRound(ids, mapName, game) {
	for(var i = 0; i < ids.length; i++) {
		var playerId = ids[i];
		var spawnPoint = MapInfo[mapName].spawnLocations[i];
		var newPlayer = new Player(spawnPoint.x * TILE_SIZE, spawnPoint.y * TILE_SIZE, "down", playerId);
		newPlayer.spawnPoint = spawnPoint;

		game.players[playerId] = newPlayer;
		game.bombs[playerId] = {};
	}

	game.numPlayersAlive = ids.length;
};

function onRegisterMap(data) {
	games[this.gameId].map = new Map(data, TILE_SIZE);
};

function onMovePlayer(data) {
	var game = games[this.gameId];

	var movingPlayer = game.players[this.id];

	// Moving player can be null if a player is killed and leftover movement signals come through.
	if(!movingPlayer) {
		return;
	}

	movingPlayer.x = data.x;
	movingPlayer.y = data.y;
	movingPlayer.facing = data.facing;
};

function onPlaceBomb(data) {
	var game = games[this.gameId];
	var gameId = this.gameId;

	var bombId = data.id;
	var playerId = this.id;

	var normalizedBombLocation = game.map.findNearestTileCenter(data.x, data.y);
	game.bombs[playerId][bombId]= new Bomb(normalizedBombLocation.x, normalizedBombLocation.y, bombId);

	setTimeout(function() {
		var explosionData = game.bombs[playerId][bombId].detonate(game.map, 2, game.players);

		delete game.bombs[playerId][bombId];

		socket.sockets.in(gameId).emit("detonate", {explosions: explosionData.explosions, id: bombId});

		explosionData.killedPlayers.forEach(function(killedPlayerId) {
			game.players[killedPlayerId].alive = false;
			handlePlayerDeath(killedPlayerId, gameId);
		});
	}, 2000);

	socket.sockets.to(this.gameId).emit("place bomb", {x: normalizedBombLocation.x, y: normalizedBombLocation.y, id: data.id});
};

function handlePlayerDeath(id, gameId) {
	socket.sockets.in(gameId).emit("kill player", {id: id});
	games[gameId].numPlayersAlive--;
	if(games[gameId].numPlayersAlive == 1) {
		endRound(gameId);
	}
};

function endRound(gameId) {
	var game = games[gameId];
	var gameMetadata = Lobby.getLobbySlots()[gameId];

	beginRound(gameMetadata.playerIds, gameMetadata.mapName, game);
	socket.sockets.in(gameId).emit("restart");
};

function broadcastingLoop() {
	for(var g in games) {
		var game = games[g];
		for(var i in game.players) {
			var player = game.players[i];
			if(player.alive) {
				socket.sockets.in(g).emit("move player", {id: player.id, x: player.x, y: player.y, facing: player.facing, timestamp: (+new Date())});
			}
		}
	}
};