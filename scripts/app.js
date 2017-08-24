/*
 * Websensor Pong demo
 * https://github.com/jessenie-intel/websensor-pong
 *
 * Copyright (c) 2017 Jesse Nieminen
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
*/

//Inspired by http://buildnewgames.com/webgl-threejs/

'use strict';

//This is an inclination sensor that uses RelativeOrientationSensor and converts the quaternion to Euler angles
class RelativeInclinationSensor {
        constructor() {
        this.sensor_ = new RelativeOrientationSensor({ frequency: 60 });
        this.x_ = 0;
        this.y_ = 0;
        this.z_ = 0;
        this.sensor_.onreading = () => {
                let quat = this.sensor_.quaternion;
                let quaternion = new THREE.Quaternion();        //Conversion to Euler angles done in THREE.js so we have to create a THREE.js object for holding the quaternion to convert from
                let euler = new THREE.Euler( 0, 0, 0);  //Will hold the Euler angles corresponding to the quaternion
                quaternion.set(quat[0], quat[1], quat[2], quat[3]);     //x,y,z,w
                //Order of rotations must be adapted depending on orientation - for portrait ZYX, for landscape ZXY
                let angleOrder = null;
                screen.orientation.angle === 0 ? angleOrder = 'ZYX' : angleOrder = 'ZXY';
                euler.setFromQuaternion(quaternion, angleOrder);     //ZYX works in portrait, ZXY in landscape
                this.x_ = euler.x;
                this.y_ = euler.y;
                this.z_ = euler.z;
                if (this.onreading_) this.onreading_();
        };
        }
        start() { this.sensor_.start(); }
        stop() { this.sensor_.stop(); }
        get x() {
                return this.x_;
        }
        get y() {
                return this.y_;
        } 
        get z() {
                return this.z_;
        }
        set onactivate(func) {
                this.sensor_.onactivate_ = func;
        }
        set onerror(err) {
                this.sensor_.onerror_ = err;
        }
        set onreading (func) {
                this.onreading_ = func;  
        }
}

//Player class
class Player {
        constructor() {
        this.score_ = 0;
        this.paddle_ = null;
        }
        increaseScore() {
                this.score_ += 1;
        }
        get score() {
                return this.score_;
        }
        get paddle() {
                return this.paddle_;
        }
}

const container = document.getElementById("gameCanvas");
var oriSensor = new RelativeInclinationSensor();

//Required for a THREE.js scene
var renderer = new THREE.WebGLRenderer();
var scene = new THREE.Scene();

var pointLight, spotLight;

//Create camera
const FOV = 50;
const ASPECT = 640 / 360;
const NEAR = 0.1;
const FAR = 10000;
var camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR);

// field variables
var fieldWidth = 400, fieldHeight = 200;

// paddle variables
var paddleWidth, paddleHeight, paddleDepth, paddleQuality;
var paddle1DirY = 0, paddle2DirY = 0, paddleSpeed = 8;

// ball variables
var ball, paddle1, paddle2;
var ballDirX = 1, ballDirY = 1;

const ballSpeedInitial = 2;     //We want to store the initial ball speed value for later use
var ballSpeed = ballSpeedInitial;

//Timer
var time=0;
var timerVar = null;

var player1 = new Player();
var player2 = new Player();
//Scores
var score1 = 0; //Player's score
var score2 = 0; //Opponent's score
const maxScore = 7;

//Opponent difficulty (between 0 and 1)
var difficulty = 0.2;

//For the scoreboard canvas
var canvas1 = null;
var context1 = null;
var texture1 = null;

//Service worker registration
if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
                navigator.serviceWorker.register('sw.js').then(function(registration) {
                        //Registration was successful
                }, function(err) {
                        //Registration failed
                console.log('ServiceWorker registration failed: ', err);
                });
        });
}

function init()
{
        //ThreeJS scene setup below
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio( window.devicePixelRatio );
	scene.add(camera);
	
	//Set up all the objects in the scene (table, ball, paddles)	
	createScene();

        container.innerHTML = "";
	container.appendChild(renderer.domElement);
        //Sensor initialization
        oriSensor.start();

        window.addEventListener( 'resize', onWindowResize, false );     //On window resize, also resize canvas so it fills the screen

        function onWindowResize() {
                camera.updateProjectionMatrix();
                renderer.setSize( window.innerWidth , window.innerHeight);
        }
	
	render();
        timerVar=setInterval(function(){time = time + 10;},10);  //Timer in ms, lowest possible value is 10, accurate enough though
}

function createScene()  //A modified version of the scene from http://buildnewgames.com/webgl-threejs/
{
	//Set up the playing surface plane 
	let planeWidth = fieldWidth,
		planeHeight = fieldHeight,
		planeQuality = 10;
		
	//Create materials for the objects
	let paddle1Material =
	  new THREE.MeshLambertMaterial(
		{
		  color: "blue"
		});
	let paddle2Material =
	  new THREE.MeshLambertMaterial(
		{
		  color: "red"
		});
	let planeMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: "green"
		});
	let tableMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: "black"
		});
	let pillarMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: "orange"
		});
	let groundMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: "burlywood"
		});
		
		
	//Create the playing surface plane
	var plane = new THREE.Mesh(

	  new THREE.PlaneGeometry(
		planeWidth * 0.95,	//95% of table width, since we want to show where the ball goes out of bounds
		planeHeight,
		planeQuality,
		planeQuality),

	  planeMaterial);
	  
	scene.add(plane);
	plane.receiveShadow = true;	
	
	let table = new THREE.Mesh(

	  new THREE.CubeGeometry(
		planeWidth * 1.05,
		planeHeight * 1.03,
		100,
		planeQuality,
		planeQuality,
		1),

	  tableMaterial);
	table.position.z = -51;
	scene.add(table);
	table.receiveShadow = true;	
		
	//Create the ball
	let sphereMaterial =
	  new THREE.MeshLambertMaterial(
		{
		  color: "white"
		});
        let radius = 5;
	ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 6), sphereMaterial);

	scene.add(ball);
	
	ball.position.x = 0;
	ball.position.y = 0;
	ball.position.z = radius;
	ball.receiveShadow = true;
        ball.castShadow = true;
	
	//Paddle vars
	paddleWidth = 10;
	paddleHeight = 30;
	paddleDepth = 10;
	paddleQuality = 1;

        let paddleGeom = new THREE.CubeGeometry(
		paddleWidth,
		paddleHeight,
		paddleDepth,
		paddleQuality,
		paddleQuality,
		paddleQuality);
		
	paddle1 = new THREE.Mesh(
                paddleGeom,
	        paddle1Material);

	
	paddle2 = new THREE.Mesh(
		paddleGeom,
                paddle2Material);

	scene.add(paddle1);  
	scene.add(paddle2);
	
	//Position the paddles
	paddle1.position.x = -fieldWidth/2 + paddleWidth;
	paddle2.position.x = fieldWidth/2 - paddleWidth;
	paddle1.position.z = paddleDepth;
	paddle2.position.z = paddleDepth;
		
        //Create pillars
	for (var i = 0; i < 5; i++)
	{
		var backdrop = new THREE.Mesh(
		
		  new THREE.CubeGeometry( 
		  30, 
		  30, 
		  300, 
		  1, 
		  1,
		  1 ),

		  pillarMaterial);
		  
		backdrop.position.x = -50 + i * 100;
		backdrop.position.y = 230;
		backdrop.position.z = -30;		
		backdrop.castShadow = true;
		backdrop.receiveShadow = true;		  
		scene.add(backdrop);	
	}
	for (var i = 0; i < 5; i++)
	{
		var backdrop = new THREE.Mesh(

		  new THREE.CubeGeometry( 
		  30, 
		  30, 
		  300, 
		  1, 
		  1,
		  1 ),

		  pillarMaterial);
		  
		backdrop.position.x = -50 + i * 100;
		backdrop.position.y = -230;
		backdrop.position.z = -30;
		backdrop.castShadow = true;
		backdrop.receiveShadow = true;		
		scene.add(backdrop);	
	}
	
	//Add a ground plane for decoration
	let ground = new THREE.Mesh(

	  new THREE.CubeGeometry( 
	  1000, 
	  1000, 
	  3, 
	  1, 
	  1,
	  1 ),
	  groundMaterial);
	ground.position.z = -132;
	ground.receiveShadow = true;	
	scene.add(ground);		
		
	//Create a point light to make the scene look nicer
	pointLight = new THREE.PointLight(0xF8D898);
	pointLight.position.x = -1000;
	pointLight.position.y = 0;
	pointLight.position.z = 1000;
	pointLight.intensity = 2.9;
	pointLight.distance = 10000;
	scene.add(pointLight);

	//Scoreboard
	canvas1 = document.createElement('canvas');
	context1 = canvas1.getContext('2d');
	context1.fillStyle = "rgba(255,255,255,0.95)";
        context1.textAlign="center";
        context1.textBaseline = 'middle';
	//Tell the player what score is needed to win
	context1.font = "Bold 20px Arial";
	context1.fillText("First to " + maxScore + " wins", canvas1.width/2, canvas1.height/2);
	context1.font = "Bold 40px Arial";
    
	//Canvas contents will be used for a texture
	texture1 = new THREE.Texture(canvas1);
        texture1.minFilter = THREE.LinearFilter;
	texture1.needsUpdate = true;
      
        let material1 = new THREE.MeshBasicMaterial( {map: texture1, side:THREE.DoubleSide } );
        material1.transparent = true;

        let mesh1 = new THREE.Mesh(
        new THREE.PlaneGeometry(canvas1.width, canvas1.height),
        material1
        );
	mesh1.position.set(fieldWidth/2, 0, 40);
	scene.add( mesh1 );
        //Rotate the text so it faces the player
        mesh1.rotateZ(-Math.PI/2);
        mesh1.rotateX(Math.PI/2);

	renderer.shadowMap.enabled = true;		
}

function render()
{	
	renderer.render(scene, camera);
	requestAnimationFrame(render);
	
	ballPhysics();
	paddlePhysics();
	cameraMovement();
	playerPaddleMovement();
	opponentPaddleMovement();
}

function ballPhysics()
{
        ballSpeed = ballSpeedInitial + (ballSpeedInitial * time/10000); //Increase ball speed with time
        ballSpeed = Math.max(ballSpeedInitial, Math.min(ballSpeed, 6))     //Clamp the speed
	//Ball goes off the player's side - opponent scores
	if (ball.position.x <= -fieldWidth/2)
	{	
		score2++;
		//Update scoreboard
                context1.clearRect(0, 0, canvas1.width, canvas1.height);
                context1.fillText(score1 + '-' + score2, canvas1.width/2, canvas1.height/2);
                texture1.needsUpdate = true;
		resetBall(2);
                time = 0;       //Reset timer
		matchScoreCheck();
	}	
	//Ball goes off the CPU's side - player scores
	else if (ball.position.x >= fieldWidth/2)
	{	
		score1++;
                context1.clearRect(0, 0, canvas1.width, canvas1.height);
                context1.fillText(score1 + '-' + score2, canvas1.width/2, canvas1.height/2);
                texture1.needsUpdate = true;
		resetBall(1);
                time = 0;
		matchScoreCheck();
	}
	
	//Bounce off table border to keep the ball on the table
	if (ball.position.y <= -fieldHeight/2)
	{
		ballDirY = -ballDirY;
	}	
	else if (ball.position.y >= fieldHeight/2)
	{
		ballDirY = -ballDirY;
	}
	
	//Move the ball
	ball.position.x += ballDirX * ballSpeed;
	ball.position.y += ballDirY * ballSpeed;
	
	//Limit ball's y-speed to make it easier (ball does not go too fast in left-right direction)
        let maxYSpeed = Math.min(1.2 * ballSpeedInitial, ballSpeed);
	if (ballDirY > maxYSpeed)
	{
		ballDirY = maxYSpeed;
	}
	else if (ballDirY < -maxYSpeed)
	{
		ballDirY = -maxYSpeed;
	}
}

// Handles opponent paddle movement and logic
function opponentPaddleMovement()
{
	// Lerp towards the ball on the y plane
	paddle2DirY = (ball.position.y - paddle2.position.y) * difficulty;
	
	// in case the Lerp function produces a value above max paddle speed, we clamp it
	if (Math.abs(paddle2DirY) <= paddleSpeed)
	{	
		paddle2.position.y += paddle2DirY;
	}
	// if the lerp value is too high, we have to limit speed to paddleSpeed
	else
	{
		// if paddle is lerping in +ve direction
		if (paddle2DirY > paddleSpeed)
		{
			paddle2.position.y += paddleSpeed;
		}
		// if paddle is lerping in -ve direction
		else if (paddle2DirY < -paddleSpeed)
		{
			paddle2.position.y -= paddleSpeed;
		}
	}
}


// Handles player's paddle movement
function playerPaddleMovement()
{
        let direction = null;
        let force = 0;
        switch(screen.orientation.angle) {
                default:
                case 0:
                        oriSensor.y < 0 ? direction = "left" : direction = "right";
                        force = Math.abs(oriSensor.y);
                break;
                case 90:
                        oriSensor.x < 0 ? direction = "left" : direction = "right";
                        force = Math.abs(oriSensor.x);
                break;
                case 270:
                        oriSensor.x < 0 ? direction = "right" : direction = "left";
                        force = Math.abs(oriSensor.x);
                break;
                }
	if (direction === "left")		
	{
		//If paddle is not touching the side of table then move
		if (paddle1.position.y < fieldHeight * 0.45)
		{
			paddle1DirY = paddleSpeed * force;
		}
		else
		{
			paddle1DirY = 0;
		}
	}	
	else if (direction === "right")
	{
		if (paddle1.position.y > -fieldHeight * 0.45)
		{
			paddle1DirY = -paddleSpeed * force;
		}
		else
		{
			paddle1DirY = 0;
		}
	}
	else
	{
		//Stop the paddle (no direction)
		paddle1DirY = 0;
	}	
	paddle1.position.y += paddle1DirY;
}

// Handles camera and lighting logic
function cameraMovement()
{	
	// move to behind the player's paddle
	camera.position.x = paddle1.position.x - 100;
	camera.position.y += (paddle1.position.y - camera.position.y) * 0.05;
	camera.position.z = paddle1.position.z + 100 + 0.04 * (-ball.position.x + paddle1.position.x);
	
	// rotate to face towards the opponent
	camera.rotation.x = -0.01 * (ball.position.y) * Math.PI/180;
	camera.rotation.y = -60 * Math.PI/180;
	camera.rotation.z = -90 * Math.PI/180;
}

// Handles paddle collision logic
function paddlePhysics()
{	
	//If ball is aligned with paddle1 on x plane
	if (ball.position.x <= paddle1.position.x + paddleWidth
	&&  ball.position.x >= paddle1.position.x - paddleWidth)
	{
		//And if ball is aligned with paddle1 on y plane
		if (ball.position.y <= paddle1.position.y + paddleHeight/2
		&&  ball.position.y >= paddle1.position.y - paddleHeight/2)
		{
			//And if ball is travelling towards player (-ve direction)
			if (ballDirX < 0)
			{
				//Bounce
				ballDirX = -ballDirX;
				//Impact ball angle when hitting it to make it possible to direct the ball
				ballDirY -= paddle1DirY * 0.4;
			}
		}
	}

        //Same for opponent paddle
	if (ball.position.x <= paddle2.position.x + paddleWidth
	&&  ball.position.x >= paddle2.position.x - paddleWidth)
	{
		if (ball.position.y <= paddle2.position.y + paddleHeight/2
		&&  ball.position.y >= paddle2.position.y - paddleHeight/2)
		{
			if (ballDirX > 0)
			{
				ballDirX = -ballDirX;
				ballDirY -= paddle2DirY * 0.7;
			}
		}
	}
}

function resetBall(loser)
{
	//Reset ball position
	ball.position.x = 0;
	ball.position.y = 0;
	
	//If player lost the last point, we send the ball towards the opponent
	if (loser == 1)
	{
		ballDirX = -1;
	}
	//If opponent lost, we send ball towards the player
	else
	{
		ballDirX = 1;
	}
	
	//Set the ball to move +ve in y plane (towards left from the camera)
	ballDirY = 1;
}

var bounceTime = 0;
//Checks if either player or opponent has reached max points
function matchScoreCheck()
{
	//If player has max points
	if (score1 >= maxScore)
	{
                winner = player1;
		//Stop the ball
		ballSpeed = 0;
                context1.clearRect(0, 0, canvas1.width, canvas1.height);
	        context1.font = "Bold 20px Arial";
                context1.fillText("You win, congratulations!", canvas1.width/2, canvas1.height/2);
                texture1.needsUpdate = true;
	}
	//If opponent has max points
	else if (score2 >= maxScore)
	{
                winner = player2;
		ballSpeed = 0;
                context1.clearRect(0, 0, canvas1.width, canvas1.height);
	        context1.font = "Bold 20px Arial";
                context1.fillText("Opponent wins!", canvas1.width/2, canvas1.height/2);
                texture1.needsUpdate = true;
	}
}
