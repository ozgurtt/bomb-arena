var remotePlayerUpdateInterval = 100;

var RemotePlayer = function(x, y, id) {
	this.id = id;
	this.previousPosition = {x: x, y: y};
	this.lastMoveTime = 0;
	this.targetPosition;

	Phaser.Sprite.call(this, game, x, y, "bomberman");

	game.physics.enable(this, Phaser.Physics.ARCADE);

	this.anchor.setTo(.5, .5);

	this.animations.add('down', [0, 1, 2, 3, 4], 10, true);
  	this.animations.add('up', [5, 6, 7, 8, 9], 10, true);
  	this.animations.add('right', [10, 11, 12], 10, true);
  	this.animations.add('left', [13, 14, 15], 10, true);

	game.add.existing(this);
};

RemotePlayer.prototype = Object.create(Phaser.Sprite.prototype);

RemotePlayer.prototype.interpolate = function(lastFrameTime) {
	if(this.distanceToCover && lastFrameTime) {
		if((this.distanceCovered.x < Math.abs(this.distanceToCover.x) || this.distanceCovered.y < Math.abs(this.distanceToCover.y))) {
          var fractionOfTimeStep = (game.time.now - lastFrameTime) / remotePlayerUpdateInterval;
          var distanceCoveredThisFrameX = fractionOfTimeStep * this.distanceToCover.x;
          var distanceCoveredThisFrameY = fractionOfTimeStep * this.distanceToCover.y;

          this.distanceCovered.x += Math.abs(distanceCoveredThisFrameX);
          this.distanceCovered.y += Math.abs(distanceCoveredThisFrameY);

          this.position.x += distanceCoveredThisFrameX;
          this.position.y += distanceCoveredThisFrameY;
        } else {
          this.position.x = this.targetPosition.x;
          this.position.y = this.targetPosition.y;
        }
    }
}

module.exports = RemotePlayer;