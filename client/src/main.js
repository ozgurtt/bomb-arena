window.game = new Phaser.Game(600, 600, Phaser.CANVAS, '');
window.player = null;
window.socket = null;
window.level = null;

startGame();

function startGame() {
	// socket = io("https://limitless-brook-9339.herokuapp.com:443");
    socket = io("http://localhost:8000");

    require("./game/mods/phaser_enhancements");

	game.state.add("Boot", require("./game/states/boot"));
	game.state.add("Preloader", require("./game/states/preloader"));
	game.state.add("Lobby", require("./game/states/lobby"));
	game.state.add("StageSelect", require("./game/states/stage_select"));
	game.state.add("PendingGame", require("./game/states/pending_game"));
	game.state.add("Level", require("./game/states/level"));

	game.state.start('Boot');
};