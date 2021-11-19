"use strict";

var canvas, gl, program;

var viewMode = 0;
var NumVertices = 36; //(6 faces)(2 triangles/face)(3 vertices/triangle)
var fetching = false;
var movementMode = 0;
var points = [];
var normals = [];
var cyl_vertices,cyl_normals;
var sph_points=[];
var sph_normals=[];

// lower and upper arm vertices
var vertices = [
    vec4( -0.5, -0.5,  0.5, 1.0 ),
    vec4( -0.5,  0.5,  0.5, 1.0 ),
    vec4(  0.5,  0.5,  0.5, 1.0 ),
    vec4(  0.5, -0.5,  0.5, 1.0 ),
    vec4( -0.5, -0.5, -0.5, 1.0 ),
    vec4( -0.5,  0.5, -0.5, 1.0 ),
    vec4(  0.5,  0.5, -0.5, 1.0 ),
    vec4(  0.5, -0.5, -0.5, 1.0 )
];

// lower and upper arm vetex normals
var vertexNormals=[];
// Parameters controlling the size of the Robot's arm

var BASE_HEIGHT      = 0.5;
var BASE_WIDTH       = 1.0;
var LOWER_ARM_HEIGHT = 2.0;
var LOWER_ARM_WIDTH  = 0.3;
var UPPER_ARM_HEIGHT = 2.0;
var UPPER_ARM_WIDTH  = 0.3;

// Shader transformation matrices

var modelViewMatrix, projectionMatrix;

// Array of rotation angles (in degrees) for each rotation axis
const NumSides = 12;
var Base = 0;
var LowerArm = 1;
var UpperArm = 2;

var old_x,old_y,old_z,new_x,new_y,new_z;
var theta= [ 0.0, 0.0, 0.0];
var current_theta = [0.0,0.0,0.0];
var sphere_theta = [0.0,0.0,0.0];
var inHand = false;

var angle = 0;

var modelViewMatrixLoc,normalMatrixLoc;

var vBuffer, nBuffer, cyl_vBuffer;

// Light source parameters
var light_ambient = vec4(0.1,0.1,0.1,1.0);
var light_diffuse = vec4(0.6,0.6,0.6,1.0);
var light_specular = vec4(0.7,0.8,0.7,1.0);
var light_position = vec4(0.5,2.0,2.0,1.0);
// Global ambient light:
var global_amb = vec4(0.1,0.1,0.1,1.0);


// Material Properties
var upperArm_ambient = vec4(0.7,0.0,0.03,1.0);
var upperArm_diffuse = vec4(0.8,0.0,0.12,1.0);
var upperArm_specular = vec4(0.90,0.7,0.91,1.0);
var lowerArm_ambient = vec4(0.0,0.7,0.03,1.0);
var lowerArm_diffuse = vec4(0.0,0.8,0.12,1.0);
var lowerArm_specular = vec4(0.7,0.99,0.91,1.0);
var base_ambient = vec4(0.0,0.3,0.3,1.0);
var base_diffuse = vec4(0.0,0.8,0.8,1.0);
var base_specular = vec4(0.7,0.99,0.99);
var shininess = 129.0;

// help functions to build the whole robot arm
// ------------------------
function buildCylPoints(){
    var x, z;
    var angle = 0;
    var NumSides=12;
    var inc = Math.PI * 2.0 / NumSides;

    cyl_vertices = new Array(NumSides * 2);


    for(var i_side = 0; i_side < NumSides; i_side++) {
        x = 0.5 * Math.cos(angle);
        z = 0.5 * Math.sin(angle);

        cyl_vertices[i_side] = vec4(x, 0.5, z,1);

        cyl_vertices[i_side+NumSides] = vec4(x, -0.5, z,1);

        angle += inc;
    }
}

//----------------------------------------------------------------------------

function quad(  a,  b,  c,  d ) {
    points.push(vertices[a]);

    points.push(vertices[b]);

    points.push(vertices[c]);

    points.push(vertices[a]);

    points.push(vertices[c]);

    points.push(vertices[d]);
}


function colorCube() {
    quad( 1, 0, 3, 2 );
    quad( 2, 3, 7, 6 );
    quad( 3, 0, 4, 7 );
    quad( 6, 5, 1, 2 );
    quad( 4, 5, 6, 7 );
    quad( 5, 4, 0, 1 );
}

function colorCylinder(){
    buildCylPoints();
    for(var i_side = 0; i_side < NumSides-1; i_side++) {
        cyl_quad(i_side+1, i_side, NumSides+i_side, NumSides+i_side+1);
    }
    cyl_quad(0, NumSides-1, 2*NumSides-1, NumSides);

    for(var i=0;i<12;i++){
        points.push(cyl_vertices[i]);
    }
    points.push(cyl_vertices[0]);
    for(var i=0;i<6;i++){
        points.push(cyl_vertices[i*2]);
    }
    points.push(cyl_vertices[0]);

    points.push(cyl_vertices[4]);
    points.push(cyl_vertices[8]);
}

function cyl_quad(a,b,c,d){
    points.push(cyl_vertices[a]);

    points.push(cyl_vertices[b]);

    points.push(cyl_vertices[c]);

    points.push(cyl_vertices[a]);

    points.push(cyl_vertices[c]);

    points.push(cyl_vertices[d]);
}
//____________________________________________

// Remmove when scale in MV.js supports scale matrices

function scale4(a, b, c) {
   var result = mat4();
   result[0][0] = a;
   result[1][1] = b;
   result[2][2] = c;
   return result;
}

//--------------------------------------------------

function sideView(){
    viewMode = 0;
}

function topView(){
    viewMode = 1;
}

//--------------------------------------------------
window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );

    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    gl.enable( gl.DEPTH_TEST );

    //
    //  Load shaders and initialize attribute buffers
    //
    program = initShaders( gl, "vertex-shader", "fragment-shader" );

    gl.useProgram( program );
    // compute the veritces and indices information for robot arm
    colorCube();
    colorCylinder();
    computeNormal();
    //compute the veritces and indices information for the sphere
    colorSphere();
    // Load shaders and use the resulting shader program

    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Create and initialize  buffer objects
    // vertex buffer
    vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );
    // vertex normal buffer
    nBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW );
    
    var vNormal = gl.getAttribLocation(program,"vNormal");
    gl.vertexAttribPointer( vNormal, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal );

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");

    projectionMatrix = ortho(-5, 5, -5, 5, -5, 10);
    // pass the light parameters to shader program
    gl.uniformMatrix4fv( gl.getUniformLocation(program, "projectionMatrix"),  false, flatten(projectionMatrix) );
    gl.uniform4fv(gl.getUniformLocation(program,"La"),light_ambient);
    gl.uniform4fv(gl.getUniformLocation(program,"Ld"),light_diffuse);
    gl.uniform4fv(gl.getUniformLocation(program,"Ls"),light_specular);
    gl.uniform4fv(gl.getUniformLocation(program,"lightPos"),light_position);
    gl.uniform4fv(gl.getUniformLocation(program,"Ga"),global_amb);
    gl.uniform1f(gl.getUniformLocation(program,"shininessVal"),shininess);

    drawRobotArm();

}

//----------------------------------------------------------------------------


function base() {
    var s = scale4(BASE_WIDTH, BASE_HEIGHT, BASE_WIDTH);
    var instanceMatrix = mult( translate( 0.0, 0.5 * BASE_HEIGHT, 0.0 ), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    var nm = normalMatrix(modelViewMatrix,false);
    gl.uniformMatrix4fv(modelViewMatrixLoc,  false, flatten(t) );
    gl.uniformMatrix4fv(normalMatrixLoc,  false, flatten(nm) );
    gl.drawArrays( gl.TRIANGLES, NumVertices, 6*12 );
    for(var i=0;i<6;i++){
        gl.drawArrays(gl.TRIANGLES,NumVertices+72+2*i,3);
    }
    for(var i=0;i<3;i++){
        gl.drawArrays(gl.TRIANGLES,121+2*i,3);
    }
    gl.drawArrays(gl.TRIANGLES,127,3);

}

//----------------------------------------------------------------------------


function upperArm() {
    var s = scale4(UPPER_ARM_WIDTH, UPPER_ARM_HEIGHT, UPPER_ARM_WIDTH);
    var instanceMatrix = mult(translate( 0.0, 0.5 * UPPER_ARM_HEIGHT, 0.0 ),s);
    var t = mult(modelViewMatrix, instanceMatrix);
    var nm = normalMatrix(modelViewMatrix,false);
    gl.uniformMatrix4fv( modelViewMatrixLoc,  false, flatten(t) );
    gl.uniformMatrix4fv(normalMatrixLoc,  false, flatten(nm) );
    gl.drawArrays( gl.TRIANGLES, 0, NumVertices );
}

//----------------------------------------------------------------------------


function lowerArm()
{
    var s = scale4(LOWER_ARM_WIDTH, LOWER_ARM_HEIGHT, LOWER_ARM_WIDTH);
    var instanceMatrix = mult( translate( 0.0, 0.5 * LOWER_ARM_HEIGHT, 0.0 ), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    var nm = normalMatrix(modelViewMatrix,false);
    gl.uniformMatrix4fv( modelViewMatrixLoc,  false, flatten(t) );
    gl.uniformMatrix4fv(normalMatrixLoc,  false, flatten(nm) );
    gl.drawArrays( gl.TRIANGLES, 0, NumVertices );
}

//----------------------------------------------------------------------------


var drawRobotArm = function() {

    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    if(viewMode==0){
        modelViewMatrix = lookAt([0,0,1],[0,0,0],[0,1,0]);
    }
    else{
        modelViewMatrix = lookAt([0,6,0],[0,2,0],[0,0,-1]);
    }
    gl.uniform4fv(gl.getUniformLocation(program,"Ka"),base_ambient);
    gl.uniform4fv(gl.getUniformLocation(program,"Kd"),base_diffuse);
    gl.uniform4fv(gl.getUniformLocation(program,"Ks"),base_specular);
    modelViewMatrix =mult(modelViewMatrix,rotate(current_theta[Base], 0, 1, 0 ));
    base();

    gl.uniform4fv(gl.getUniformLocation(program,"Ka"),lowerArm_ambient);
    gl.uniform4fv(gl.getUniformLocation(program,"Kd"),lowerArm_diffuse);
    gl.uniform4fv(gl.getUniformLocation(program,"Ks"),lowerArm_specular);
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, BASE_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotate(current_theta[LowerArm], 0, 0, 1 ));
    lowerArm();

    gl.uniform4fv(gl.getUniformLocation(program,"Ka"),upperArm_ambient);
    gl.uniform4fv(gl.getUniformLocation(program,"Kd"),upperArm_diffuse);
    gl.uniform4fv(gl.getUniformLocation(program,"Ks"),upperArm_specular);
    modelViewMatrix  = mult(modelViewMatrix, translate(0.0, LOWER_ARM_HEIGHT, 0.0));
    modelViewMatrix  = mult(modelViewMatrix, rotate(current_theta[UpperArm], 0, 0, 1) );

    upperArm();
    
    if(!fetching){
        requestAnimationFrame(drawRobotArm);
    }
}

// Cylinder 
// ----------------------------------------------------------
function computeNormal(){
    // compute by angle weighted normal
    // compute 2 arms normals first
    vertexNormals.push(add(add(vec4(0.0,-1.0/3,0.0,0.0),vec4(-1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,1.0/3,0.0)));
    vertexNormals.push(add(add(vec4(0.0,1.0/3,0.0,0.0),vec4(-1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,1.0/3,0.0)));
    vertexNormals.push(add(add(vec4(0.0,1.0/3,0.0,0.0),vec4(1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,1.0/3,0.0)));
    vertexNormals.push(add(add(vec4(0.0,-1.0/3,0.0,0.0),vec4(1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,1.0/3,0.0)));
    vertexNormals.push(add(add(vec4(0.0,-1.0/3,0.0,0.0),vec4(-1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,-1.0/3,0.0)));
    vertexNormals.push(add(add(vec4(0.0,1.0/3,0.0,0.0),vec4(-1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,-1.0/3,0.0)));
    vertexNormals.push(add(add(vec4(0.0,1.0/3,0.0,0.0),vec4(1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,-1.0/3,0.0)));
    vertexNormals.push(add(add(vec4(0.0,-1.0/3,0.0,0.0),vec4(1.0/3,0.0,0.0,0.0)),vec4(0.0,0.0,-1.0/3,0.0)));
    normalQuad( 1, 0, 3, 2 );
    normalQuad( 2, 3, 7, 6 );
    normalQuad( 3, 0, 4, 7 );
    normalQuad( 6, 5, 1, 2 );
    normalQuad( 4, 5, 6, 7 );
    normalQuad( 5, 4, 0, 1 );

    // compute cylinder normals then
    cylNormals();
}

function normalQuad(a,b,c,d){
    normals.push(vertexNormals[a]);
    normals.push(vertexNormals[b]);
    normals.push(vertexNormals[c]);
    normals.push(vertexNormals[a]);
    normals.push(vertexNormals[c]);
    normals.push(vertexNormals[d]);

}

function buildCylNormals(){
    var x, z;
    var angle = 0;
    var NumSides=12;
    var inc = Math.PI * 2.0 / NumSides;

    cyl_normals = new Array(NumSides * 2);
    for(var i = 0; i < NumSides; i++) {
        x = 0.5 * Math.cos(angle);
        z = 0.5 * Math.sin(angle);
        // compute by angle weighted, each vertex is adjacent of degree of 90, 90, 150
        cyl_normals[i] = add(vec4(x*6/11, 0.0, z*6/11,0),vec4(0.0,1.0*5/11,0.0,0.0));

        cyl_normals[i+NumSides] = add(vec4(x*6/11, 0.0, z*6/11,0),vec4(0.0,-1.0*5/11,0.0,0.0));

        angle += inc;
    }
}

function cylNormals(){
    buildCylNormals();
    for(var i = 0; i < NumSides-1; i++) {
        cyl_normalQuad(i+1, i, NumSides, NumSides+i+1);
    }
    cyl_normalQuad(0, NumSides-1, 2*NumSides-1, NumSides);
    for(var i =0;i<12;i++){
        normals.push(cyl_normals[i]);
    }
    normals.push(cyl_vertices[0]);
    for(var i=0;i<6;i++){
        normals.push(cyl_vertices[i*2]);
    }
    normals.push(cyl_vertices[0]);

    normals.push(cyl_vertices[4]);
    normals.push(cyl_vertices[8]);
}

function cyl_normalQuad(a,b,c,d){
    normals.push(cyl_normals[a]);
    normals.push(cyl_normals[b]);
    normals.push(cyl_normals[c]);
    normals.push(cyl_normals[a]);
    normals.push(cyl_normals[c]);
    normals.push(cyl_normals[d]);
}



// -------------------------------------------------------------------------------------
// Sphere:
// https://stackoverflow.com/questions/45482988/generating-spheres-vertices-indices-and-normals
function colorSphere(){
    // compute sphere vertices and normals
    var layer_size = 16, circum_size = 32, radius = 0.15;
    var circCnt = circum_size;
    var circCnt_2 = circCnt / 2;
    var layerCount = layer_size;
    for ( var tbInx = 0; tbInx <= layerCount; tbInx ++ )
    {
        var v = ( 1.0 - tbInx / layerCount );
        var heightFac = Math.sin( ( 1.0 - 2.0 * tbInx / layerCount ) * Math.PI/2.0 );
        var cosUp = Math.sqrt( 1.0 - heightFac * heightFac );
        var z = heightFac;
        for ( var i = 0; i <= circCnt_2; i ++ )
        {
          var u = i / circCnt_2;
          var angle = Math.PI * u;
          var x = Math.cos( angle ) * cosUp;
          var y = Math.sin( angle ) * cosUp;
          AddVertex( x * radius, y * radius, z * radius, x, y, z );
        }
        for ( var i = 0; i <= circCnt_2; i ++ )
        {
          var u = i / circCnt_2;
          var angle = Math.PI * u + Math.PI;
          var x = Math.cos( angle ) * cosUp;
          var y = Math.sin( angle ) * cosUp;
          AddVertex( x * radius, y * radius, z * radius, x, y, z );
        }
    }
    
    // bottom cap
    var circSize_2 = circCnt_2 + 1;
    var circSize = circSize_2 * 2;
    for ( var i = 0; i < circCnt_2; i ++ )
        AddFace( circSize + i, circSize + i + 1, i );
    for ( var i = circCnt_2+1; i < 2*circCnt_2+1; i ++ )
        AddFace( circSize + i, circSize + i + 1, i );

    // discs
    for ( var tbInx = 1; tbInx < layerCount - 1; tbInx ++ )
    {
        var ringStart = tbInx * circSize;
        var nextRingStart = (tbInx+1) * circSize;
        for ( var i = 0; i < circCnt_2; i ++ )
            AddFace( ringStart + i, nextRingStart + i, nextRingStart + i + 1, ringStart + i + 1 );
        ringStart += circSize_2;
        nextRingStart += circSize_2;
        for ( var i = 0; i < circCnt_2; i ++ )
            AddFace( ringStart + i, nextRingStart + i, nextRingStart + i + 1, ringStart + i + 1 );
    }

    // top cap
    var start = (layerCount-1) * circSize;
    for ( var i = 0; i < circCnt_2; i ++ )
        AddFace( start + i + 1, start + i, start + i + circSize );
    for ( var i = circCnt_2+1; i < 2*circCnt_2+1; i ++ )
        AddFace( start + i + 1, start + i, start + i + circSize );
}

// add sphere vertex and vertex normal
function AddVertex(x,y,z,nx,ny,nz){
    sph_points.push([x,y,z,1]);
    sph_normals.push([nx,ny,nz,0]);
}

function AddFace(i1,i2,i3,i4){
    points.push(sph_points[i1],sph_points[i2],sph_points[i3]);
    normals.push(sph_normals[i1],sph_normals[i2],sph_normals[i3]);
    if ( i4 ){
        points.push(sph_points[i1],sph_points[i3],sph_points[i4]);
        normals.push(sph_normals[i1],sph_normals[i2],sph_normals[i3]);
    }
}

function drawSphere(){
    if(viewMode==0){
        modelViewMatrix = lookAt([0,0,1],[0,0,0],[0,1,0]);
    }
    else{
        modelViewMatrix = lookAt([0,6,0],[0,2,0],[0,0,-1]);
    }
    gl.uniform4fv(gl.getUniformLocation(program,"Ka"),[0.9,0.4,0.3,1.0]);
    gl.uniform4fv(gl.getUniformLocation(program,"Kd"),[0.7,0.4,0.3,1.0]);
    gl.uniform4fv(gl.getUniformLocation(program,"Ks"),[0.9,0.8,0.8,1.0]);
    var t;
    // stay at old position
    if(movementMode==0){
        var instanceMatrix = translate( old_x, old_y, old_z );
        t = mult(modelViewMatrix, instanceMatrix);
    }
    // move with the arm
    else if(movementMode==1){
    modelViewMatrix =mult(modelViewMatrix,rotate(current_theta[Base], 0, 1, 0 ));
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, BASE_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotate(current_theta[LowerArm], 0, 0, 1 ));
    modelViewMatrix  = mult(modelViewMatrix, translate(0.0, LOWER_ARM_HEIGHT, 0.0));
    modelViewMatrix  = mult(modelViewMatrix, rotate(current_theta[UpperArm], 0, 0, 1) );
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, UPPER_ARM_HEIGHT, 0.0));
    t = modelViewMatrix;
    }
    // stay in new position
    else{
        var instanceMatrix = translate( new_x, new_y, new_z );
        t = mult(modelViewMatrix, instanceMatrix);
    }
    var nm = normalMatrix(modelViewMatrix,false);
    gl.uniformMatrix4fv( modelViewMatrixLoc,  false, flatten(t) );
    gl.uniformMatrix4fv(normalMatrixLoc,  false, flatten(nm) );
    gl.drawArrays(gl.TRIANGLES,130,points.length-130);
}

// fetch process
// -------------------------------------------------------------------------------------
function fetch(){
    old_x = document.getElementById("oldx").value;
    old_y = document.getElementById("oldy").value;
    old_z = document.getElementById("oldz").value;
    new_x = document.getElementById("newx").value;
    new_y = document.getElementById("newy").value;
    new_z = document.getElementById("newz").value;
    // current angles of the arm
    current_theta=[0,0,0];
    movementMode=0;
    if(old_x && old_y && old_z && new_x && new_y && new_z){
        // compute the angle movements for base, lower arm and upper arm
        // moving towards the ball
        fetching=true;
        theta[Base]=-Math.round(Math.atan2(old_z,old_x)*180/Math.PI);

        var point_theta = Math.atan2(Math.sqrt(Math.pow(old_x,2)+Math.pow(old_z,2)),-(old_y-0.5))*180/Math.PI;

        var arm_angle = Math.acos(Math.sqrt(Math.pow(old_x,2)+Math.pow(old_y-0.5,2)+Math.pow(old_z,2))/(2.0*UPPER_ARM_HEIGHT))*180/Math.PI;
        theta[LowerArm]=-Math.round((180-point_theta-arm_angle));

        theta[UpperArm]=Math.round(-2*arm_angle);
        // recursively render the scence
        requestAnimationFrame(render);

    }

}

function render(){
    // compute the current angle
    if(current_theta[Base]<theta[Base]){
        current_theta[Base]+=0.25;
    }
    else if(current_theta[Base]>theta[Base]){
        current_theta[Base]-=0.25;
        if(movementMode==1){
        }
    }
    if(current_theta[LowerArm]<theta[LowerArm]){
        current_theta[LowerArm]+=0.25;
    }
    else if(current_theta[LowerArm]>theta[LowerArm]){
        current_theta[LowerArm]-=0.25;
    }
    if(current_theta[UpperArm]<theta[UpperArm]){
        current_theta[UpperArm]+=0.25;
    }
    else if(current_theta[UpperArm]>theta[UpperArm]){
        current_theta[UpperArm]-=0.25;
    }
    // draw the sphere
    drawRobotArm();
    drawSphere(old_x,old_y,old_z);
    detectMovementMode();
    // During the period of cathing the ball case:
    if(movementMode==0){
        requestAnimationFrame(render);
    }
    // ball in hand case;
    else if(movementMode==1){
        theta[Base]=-Math.round(Math.atan2(new_z,new_x)*180/Math.PI);

        var point_theta = Math.atan2(Math.sqrt(Math.pow(new_x,2)+Math.pow(new_z,2)),-(new_y-0.5))*180/Math.PI;

        var arm_angle = Math.acos(Math.sqrt(Math.pow(new_x,2)+Math.pow(new_y-0.5,2)+Math.pow(new_z,2))/(2.0*UPPER_ARM_HEIGHT))*180/Math.PI;
        theta[LowerArm]=-Math.round((180-point_theta-arm_angle));
        theta[UpperArm]=Math.round(-2*arm_angle);
        requestAnimationFrame(render);
    }
    // released ball and return to initial point case:
    else{
        theta[Base]=0;
        theta[LowerArm]=0;
        theta[UpperArm]=0;
        requestAnimationFrame(render);
    }
}
// 3 steps in the whole porgress. movement mode 0 for step 1(catch the ball)
// movement mode 1 for step 2(drag the ball) and otherwise for step 3(release the ball and return to initial arm position)
function detectMovementMode(){
    if(current_theta[Base]==theta[Base] && current_theta[LowerArm]==theta[LowerArm] && current_theta[UpperArm]==theta[UpperArm]){
        movementMode++;
    }
}