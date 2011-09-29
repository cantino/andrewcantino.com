// World

var World = function(width, height, canvas) {
  this.canvas = $(canvas);
	this.context = this.canvas.get(0).getContext('2d');
	this.width = width;
	this.height = height;
	this.interval = 20;
	this.foodSupply = new FoodSupply(4, this);
  this.pheromones = [];
	this.makeAntHills(1);
  this.setupBindings();
  this.showPheromones = false;
};

World.prototype = new Object();

World.prototype.makeAntHills = function(num) {
	this.antHills = [];
	for(var i = 0; i < num; i++) {
		this.antHills.push(new AntHill(this));
	}	
};

World.prototype.tick = function() {
	for(var i = 0; i < this.antHills.length; i++) {
		this.antHills[i].tick();
	}
	for(var i = 0; i < this.pheromones.length; i++) {
		this.pheromones[i].tick();
	}
};

World.prototype.render = function() {
	this.context.clearRect(0, 0, this.width, this.height);

  if (this.showPheromones) {
    for(var i = 0; i < this.pheromones.length; i++) {
      this.pheromones[i].render(this.context);
    }
  }
	for(var i = 0; i < this.antHills.length; i++) {
		this.antHills[i].render(this.context);
	}
	this.foodSupply.render(this.context);
  if (this.lastObject) this.lastObject.renderInfo(this.context);
};

World.prototype.setupBindings = function() {
  var world = this;
  this.canvas.mousemove(function(e) {
    var mouse = new Vector(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
    var closestObject = world.findClosestObject(mouse);
    if (closestObject.distTo(mouse) < 15) {
      world.lastObject = closestObject;
    } else {
      world.lastObject = null;
    }
  }).click(function(e) {
    var mouse = new Vector(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
    world.foodSupply.addNewFood(mouse)
    return false;
  });
};

World.prototype.center = function() {
  return new Vector(this.width / 2.0, this.height / 2.0);
};

World.prototype.objects = function() {
  var objects = [];
  for(var i = 0; i < this.antHills.length; i++) {
    objects.push(this.antHills[i]);
    for(var j = 0; j < this.antHills[i].ants.length; j++) {
      objects.push(this.antHills[i].ants[j]);
    }
  }
  for(var i = 0; i < this.foodSupply.food.length; i++) {
    objects.push(this.foodSupply.food[i]);
  }
  return objects;
};

World.prototype.findClosestObject = function(pos) {
  var best = 1000000000000;
  var bestObj = null;
  var objects = this.objects();
  for(var i = 0; i < objects.length; i++) {
    var dist = objects[i].distTo(pos);
    if (dist < best) {
      best = dist;
      bestObj = objects[i];
    }
  }
  return bestObj;
};

World.prototype.start = function() {
	var world = this;
	world.stopNow = false;
	function makeTimeout() {
		setTimeout(function() {
			world.tick();
			world.render();
			if (!world.stopNow) makeTimeout();
		}, world.interval);
	}
	makeTimeout();
	return false;
};

World.prototype.stop = function() {
	this.stopNow = true;
	return false;
};

World.prototype.closePheromones = function(pos, dist) {
  var out = [];
  var closest = null;
  var bestDist = 1000000000;
  for(var i = this.pheromones.length - 1; i >= 0; i--) {
    if (this.pheromones[i].distTo(pos) < dist) {
      if (dist < bestDist) {
        bestDist = dist;
        closest = this.pheromones[i];
      }
      out.push(this.pheromones[i]);
    }
  }
  return { pheromones: out, closest: closest };
};

World.prototype.removePheromone = function(pheromone) {
  for(var i = 0; i < this.pheromones.length; i++) {
    if (this.pheromones[i] == pheromone) {
      this.pheromones.splice(i, 1);
      return;
    }
  }
};

World.prototype.addPheromone = function(pos) {
  this.pheromones.push(new Pheromone(pos, world));
};


// BaseObject

var WorldObject = function() {};
WorldObject.prototype = new Object();
WorldObject.prototype.renderBasicInfo = function(context, text) {
  this.render(context, true);
  context.save();
  context.fillStyle = "rgb(0,0,0)";
  context.shadowOffsetX = 2;
  context.shadowOffsetY = 2;
  context.shadowBlur = 2;
  context.shadowColor = "rgba(0, 0, 0, 0.3)";
  context.fillText((text ? text : this.type), this.position.x, this.position.y - 10);
  context.restore();
};
WorldObject.prototype.renderInfo = function(context) {
  this.renderBasicInfo(context);
}
WorldObject.prototype.distTo = function(v) {
  return this.position.distTo(v) - this.size.x / 2.0; // approximation
};


// FoodSupply

var FoodSupply = function(num, world) {
	this.world = world;
	this.randomize(num || 5);
};

FoodSupply.prototype = new Object();

FoodSupply.prototype.randomize = function(number) {
	this.food = [];
  this.originalFoodLength = number;
	for(var i = 0; i < number; i++) {
    this.addNewFood();
	}
};

FoodSupply.prototype.addNewFood = function(pos) {
  this.food.push(new Food(this, pos));
};

FoodSupply.prototype.render = function(context) {
	for(var i = 0; i < this.food.length; i++) {
		this.food[i].render(context);
	}
};

FoodSupply.prototype.closestFood = function(pos) {
  var bestFood = this.food[0];
  var bestDist = this.food[0].distTo(pos);
  for(var i = 1; i < this.food.length; i++) {
    var dist = this.food[i].distTo(pos);
    if (dist < bestDist) {
      bestDist = dist;
      bestFood = this.food[i];
    }
  }
  return bestFood;
};

FoodSupply.prototype.remove = function(food) {
  for(var i = 0; i < this.food.length; i++) {
    if (this.food[i] == food) {
      this.food.splice(i, 1);
      if (this.food.length < this.originalFoodLength) this.addNewFood();
      return;
    }
  }
};


// Food

var Food = function(supply, pos) {
	this.supply = supply;
  this.position = pos || supply.world.center().plus(new Vector(Math.random() * 300 - 150, Math.random() * 300 - 150));
  this.amount = Math.random() * 40 + 10;
  this.type = "food";
  this.setSize();
};

Food.prototype = new WorldObject();

Food.prototype.setSize = function() {
  this.size = new Vector((this.amount / 50.0) * 30, (this.amount / 50.0) * 30);
};

Food.prototype.decrement = function(amt) {
  this.amount -= (amt || 1.0);
  this.setSize();
  if (this.amount <= 0) this.supply.remove(this);
};

Food.prototype.render = function(context, highlight) {
  if (!this.path) {
    this.path = [];
    var steps = 10;
    var p = new Vector(1, 0);
    for(var i = 0; i < steps; i++) {
      p.rotateSelf(2 * Math.PI / steps);
      var v = p.times(0.75 + (Math.random() * 0.5 - 0.25));
      this.path.push(v);
    }
  }

  context.beginPath();
  var p = this.position.plus(this.path[0].times(this.size.x));
  context.moveTo(p.x, p.y);
  for(var i = 1; i < this.path.length; i++) {
    p = this.position.plus(this.path[i].times(this.size.x));
    context.lineTo(p.x, p.y);
  }
  context.fillStyle = highlight ? "rgb(255,255,0)" : "rgb(0,255,0)";
  context.closePath();
  context.fill();
};

Food.prototype.renderInfo = function(context) {
  this.renderBasicInfo(context, parseInt(this.amount) + " food left");
};


// Pheromone

var Pheromone = function(pos, world) {
	this.world = world;
  this.position = new Vector(pos);
  this.size = new Vector(3, 3);
  this.type = "pheromone";
  this.age = 0;
  this.maxAge = 410;
  this.id = parseInt(Math.random() * 10000000000);
};

Pheromone.prototype = new WorldObject();

Pheromone.prototype.tick = function() {
  this.age += 1;

  if (this.age > this.maxAge) {
    this.world.removePheromone(this);
  }
};

Pheromone.prototype.renderInfo = function(context) {
  this.renderBasicInfo(context, "pheromone (" + parseInt(this.age) + ")");
};

Pheromone.prototype.render = function(context) {
  context.save();

  var c = 1.0 - (this.age / this.maxAge);
  context.fillStyle = "rgba(220,220,220," + c + ")";

//  context.globalAlpha = c;
//  var radgrad = context.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, this.size.x);
//  radgrad.addColorStop(0, 'rgba(200,200,200,1)');
//  radgrad.addColorStop(1, 'rgba(255,255,255,0)');
//  context.fillStyle = radgrad;

  context.beginPath();
  context.arc(this.position.x, this.position.y, this.size.x, 0, Math.PI*2, true);
  context.closePath();
  context.fill();
  context.restore();
};


// AntHill

var AntHill = function(world) {
	this.ants = [];
	this.world = world;
  this.position = world.center().plus(new Vector(Math.random() * 300 - 150, Math.random() * 300 - 150));
  this.size = new Vector(20, 20);
  this.type = "ant hill";
  this.amount = 0;
	this.makeAnts(30);
};

AntHill.prototype = new WorldObject();

AntHill.prototype.makeAnts = function(num) {
	for(var i = 0; i < num; i++) {
		this.ants.push(new Ant(this.position, this));
	}
};

AntHill.prototype.depositFood = function() {
  this.amount += 1.0;
};

AntHill.prototype.tick = function() {
	for(var i = 0; i < this.ants.length; i++) {
		this.ants[i].tick();
	}
};

AntHill.prototype.renderInfo = function(context) {
  this.renderBasicInfo(context, "ant hill with " + parseInt(this.amount) + " food");
};

AntHill.prototype.render = function(context, highlight) {
//  context.save();
//  context.fillStyle = highlight ? "rgb(255,255,0)" : "#f00";
//  context.beginPath();
//  context.arc(this.position.x, this.position.y, this.size.x, 0, Math.PI*2, true);
//  context.closePath();
//  context.fill();
//  context.restore();

  context.save();
  var radgrad = context.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, this.size.x * 1.1);
  radgrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  radgrad.addColorStop(0.1, 'rgba(16, 16, 16, 1)');
  radgrad.addColorStop(0.3, 'rgba(120, 72, 0, 1)');
  radgrad.addColorStop(1, 'rgba(255, 255, 255, 1)');
  context.fillStyle = radgrad;
  context.beginPath();
  context.arc(this.position.x, this.position.y, this.size.x * 1.1, 0, Math.PI*2, true);
  context.closePath();
  context.fill();
  context.restore();

  for(var i = 0; i < this.ants.length; i++) {
    this.ants[i].render(context);
  }

  context.save();
  var radgrad = context.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, this.size.x);
  radgrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  radgrad.addColorStop(0.1, 'rgba(16, 16, 16, 1)');
  radgrad.addColorStop(0.3, 'rgba(120, 72, 0, 0.9)');
  radgrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = radgrad;
  context.beginPath();
  context.arc(this.position.x, this.position.y, this.size.x, 0, Math.PI*2, true);
  context.closePath();
  context.fill();
  context.restore();
};


// Ant

var Ant = function(pos, antHill) {
  this.antHill = antHill;
  this.position = new Vector(pos);
  this.size = new Vector(2, 2);
  this.type = "ant";
	this.state = "wandering";
  this.knowledge = {};
  this.recentlySeenPheromones = {};
  this.wanderingTicks = 0;
};

Ant.prototype = new WorldObject();

Ant.prototype.tick = function() {
  this.observeWorld();
  if (Math.random() > 0.995) this.forgetPheromones();

  if (this.state == "wandering" || this.state == "pheromone following") {
    if (this.knowledge.food) {
      if (this.position.distTo(this.knowledge.food.position) < 5) {
        this.knowledge.food.decrement();
        this.returnWithFood();
      } else {
        this.moveToward(this.knowledge.food.position);
      }
    } else if (this.knowledge.pheromones.length > 0 && this.wanderingTicks <= 0) {
      this.followPheromones();
    } else {
      this.wander();
    }
  } else if (this.state == "food-bearing") {
    if (this.knowledge.antHill) {
      this.knowledge.antHill.depositFood();
      this.recentlySeenPheromones = {};
      this.wander();
    } else {
      this.returnWithFood();
    }
  }
};

Ant.prototype.forgetPheromones = function() {
  var threshold = (new Date()).getTime() - 1000 * 10;
  for (var k in this.recentlySeenPheromones) {
    if (this.recentlySeenPheromones[k] < threshold) delete this.recentlySeenPheromones[k];
  }
};

Ant.prototype.followPheromones = function() {
  this.state = "pheromone following";
  var pheromone = null;
  var pheromoneAge = -1;

  if (this.lastSeenPheromone) {
    // Find a pheromone older than, but as close in age as possible to, the last seen pheromone.
    var pheromoneAge = 100000000000;
    for (var i = 0; i < this.knowledge.pheromones.length; i++) {
      if (this.knowledge.pheromones[i].age > this.lastSeenPheromone.age && this.knowledge.pheromones[i].age < pheromoneAge && !this.recentlySeenPheromones[this.knowledge.pheromones[i].id]) {
        pheromone = this.knowledge.pheromones[i];
        pheromoneAge = pheromone.age;
      }
    }
  } else {
    // Find oldest
    var pheromoneAge = -100000000000;
    for (var i = 0; i < this.knowledge.pheromones.length; i++) {
      if (this.knowledge.pheromones[i].age > pheromoneAge && !this.recentlySeenPheromones[this.knowledge.pheromones[i].id]) {
        pheromone = this.knowledge.pheromones[i];
        pheromoneAge = pheromone.age;
      }
    }
  }

  if (pheromone) {
    this.lastSeenPheromone = pheromone;
    this.recentlySeenPheromones[pheromone.id] = (new Date()).getTime();
    this.moveToward(pheromone.position);
  } else {
    this.lastSeenPheromone = null;
    this.wander();
  }
};

Ant.prototype.returnWithFood = function() {
  this.state = "food-bearing";
  if (!this.knowledge.closestPheromone || (this.knowledge.closestPheromone.distTo(this.position) > 4 && this.knowledge.pheromones.length < 20)) {
    this.antHill.world.addPheromone(this.position);
  }
  this.moveToward(this.antHill.position);
};

Ant.prototype.observeWorld = function() {
  // Look for food
  var food = this.antHill.world.foodSupply.closestFood(this.position);
  if (food.distTo(this.position) < 15) {
    this.knowledge.food = food;
  } else {
    this.knowledge.food = null;
  }

  // Look for anthill
  if (this.antHill.position.distTo(this.position) < 4) {
    this.knowledge.antHill = this.antHill;
  } else {
    this.knowledge.antHill = null;
  }

  // Look for pheromones
  var pheromoneInfo = this.antHill.world.closePheromones(this.position, 20);
  this.knowledge.pheromones = pheromoneInfo.pheromones;
  this.knowledge.closestPheromone = pheromoneInfo.closest;
};

Ant.prototype.wander = function() {
  if (this.state != "wandering") this.wanderingTicks = 5;
  this.state = "wandering";
  this.wanderingTicks -= 1;
  if (this.lastDirection) {
    var move = new Vector(this.lastDirection);
    if (Math.random() > 0.5) {
      move.rotateSelf(Math.random() * (Math.PI / 2.0) - (Math.PI / 4.0)).normalizeSelf(2.0);
    }
  } else {
    var move = new Vector((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalizeSelf(2.0);
  }
  this.moveToward(this.position.plus(move));
};

Ant.prototype.moveToward = function(pos) {
  var newDirection = pos.minus(this.position).normalizeSelf(2.0);

//  if (!this.lastDirection) this.lastDirection = new Vector((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalizeSelf(2.0);
//  var angle = this.lastDirection.angle(newDirection);
//  if (isNaN(angle)) angle = 0;
//  newDirection = this.lastDirection.rotate(angle * 0.95);

  this.lastDirection = newDirection.normalize(2.0);
  this.position.plusEq(this.lastDirection);

  if (this.position.x < 0) this.position.x = 0;
  if (this.position.y < 0) this.position.y = 0;
  if (this.position.x > this.antHill.world.width) this.position.x = this.antHill.world.width;
  if (this.position.y > this.antHill.world.height) this.position.y = this.antHill.world.height;
};

Ant.prototype.render = function(context, highlight) {
  context.save();
  context.shadowOffsetX = 1;
  context.shadowOffsetY = 1;
  context.shadowBlur = 2;
  context.shadowColor = highlight ? 'rgba(90,90,0,0.5)' : 'rgba(0, 0, 90, 0.5)';

  // The food being carried
  if (this.state == "food-bearing") {
    context.fillStyle = "rgb(0,255,0)";
    context.shadowColor   = 'rgba(0, 90, 0, 0.5)';
    context.beginPath();
    var foodPos = this.antHill.position.minus(this.position).normalize(3)
    context.arc(this.position.x + foodPos.x, this.position.y + foodPos.y, 3, 0, Math.PI*2, true);
    context.closePath();
    context.fill();
  }

  // The ant
  context.fillStyle = highlight ? "rgb(255,255,0)" : "rgb(0,0,255)";
  context.beginPath();
  if (context.arc) context.arc(this.position.x, this.position.y, this.size.x, 0, Math.PI*2, true);
  context.closePath();
  context.fill();
  context.restore();
};

Ant.prototype.renderInfo = function(context) {
  this.renderBasicInfo(context, this.state + " ant");
};
