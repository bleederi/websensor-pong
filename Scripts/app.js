var score1 = 0;
var score2 = 0;

function setup()
{
        // set the scene size
	var WIDTH = 640,
	  HEIGHT = 360;

	// set some camera attributes
	var VIEW_ANGLE = 50,
	  ASPECT = WIDTH / HEIGHT,
	  NEAR = 0.1,
	  FAR = 10000;

	var c = document.getElementById("gameCanvas");

	// create a WebGL renderer, camera
	// and a scene
	renderer = new THREE.WebGLRenderer();
	camera =
	  new THREE.PerspectiveCamera(
		VIEW_ANGLE,
		ASPECT,
		NEAR,
		FAR);

	scene = new THREE.Scene();

	// add the camera to the scene
	scene.add(camera);
	
	// set a default position for the camera
	// not doing this somehow messes up shadow rendering
	camera.position.z = 320;
	
	// start the renderer
	renderer.setSize(WIDTH, HEIGHT);

	// attach the render-supplied DOM element
        c.appendChild(renderer.domElement);
}

function draw()
{

requestAnimationFrame(draw);

}
