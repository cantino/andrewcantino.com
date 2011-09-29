var Vector = function(x, y) {
	if (x && typeof(x.x) !== "undefined") {
		// x is a vector
		this.x = x.x;
		this.y = x.y;
	} else if(typeof(x) !== "undefined" && typeof(y) !== "undefined") {
		this.x = x;
		this.y = y;
	} else {
		this.x = 0.0;
		this.y = 0.0;
	}
};

Vector.prototype = new Object();


Vector.prototype.plusEq = function(v) {
	this.x += v.x;
	this.y += v.y;
	return this;
};

Vector.prototype.plus = function(v) {
	return new Vector(this.x + v.x, this.y + v.y);
};


Vector.prototype.minusEq = function(v) {
	this.x -= v.x;
	this.y -= v.y;
	return this;
};

Vector.prototype.minus = function(v) {
	return new Vector(this.x - v.x, this.y - v.y);
};


Vector.prototype.timesEq = function(c) {
	this.x *= c;
	this.y *= c;
	return this;
};

Vector.prototype.times = function(c) {
	return new Vector(this.x * c, this.y * c);
};


Vector.prototype.magnitude = function() {
	return Math.sqrt(this.x * this.x + this.y * this.y);
};

Vector.prototype.normalizeSelf = function(newLength) {
	return this.timesEq((newLength || 1.0) / this.magnitude());
};

Vector.prototype.normalize = function(newLength) {
	return this.times((newLength || 1.0) / this.magnitude());
};


Vector.prototype.distTo = function(v) {
	return this.minus(v).magnitude();
};


Vector.prototype.rotateSelf = function(t) {
	var newx = this.x * Math.cos(t) - this.y * Math.sin(t);
	var newy = this.x * Math.sin(t) + this.y * Math.cos(t);
  this.x = newx;
  this.y = newy;
	return this;
};

Vector.prototype.rotate = function(t) {
	return new Vector(this.x * Math.cos(t) - this.y * Math.sin(t), this.x * Math.sin(t) + this.y * Math.cos(t));
};

Vector.prototype.dot = function(v) {
  return this.x * v.x + this.y * v.y;
};

Vector.prototype.angle = function(v) {
//  return Math.acos(this.normalize().dot(v.normalize()));
  var mag = this.magnitude();
  var vmag = v.magnitude();
  return Math.atan2(v.y / vmag, v.x / vmag) - Math.atan2(this.y / mag, this.x / mag);
};