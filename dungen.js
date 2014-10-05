CONNECTION_UL = 1<<3;
CONNECTION_UR = 1<<2;
CONNECTION_DR = 1<<1;
CONNECTION_DL = 1<<0;

MASK_U = CONNECTION_UL | CONNECTION_UR;
MASK_R = CONNECTION_UR | CONNECTION_DR;
MASK_D = CONNECTION_DR | CONNECTION_DL;
MASK_L = CONNECTION_DL | CONNECTION_UL;

DIRECTION_U = 0;
DIRECTION_R = 1;
DIRECTION_D = 2;
DIRECTION_L = 3;

FLAG_U = 1 << DIRECTION_U;
FLAG_R = 1 << DIRECTION_R;
FLAG_D = 1 << DIRECTION_D;
FLAG_L = 1 << DIRECTION_L;

ALL_DIRECTIONS = [DIRECTION_U, DIRECTION_R, DIRECTION_D, DIRECTION_L];

TILE_BIG_ROOM = CONNECTION_UL | CONNECTION_UR | CONNECTION_DR | CONNECTION_DL;
TILE_SMALL_ROOM = CONNECTION_UL;
TILE_HALL = CONNECTION_UL | CONNECTION_DL;
TILE_CORNER = CONNECTION_UR | CONNECTION_DR | CONNECTION_DL;

ALL_TILES = [TILE_BIG_ROOM, TILE_SMALL_ROOM, TILE_HALL, TILE_CORNER];

TILE_URLS = {};
TILE_URLS[TILE_BIG_ROOM] = "https://s3.amazonaws.com/files.d20.io/images/5831842/UeVYJBAl-eAse6nV5K4tlw/thumb.jpg?1412476647";
TILE_URLS[TILE_SMALL_ROOM] = "https://s3.amazonaws.com/files.d20.io/images/5831838/q_qYBvd7x7dSp9gSU6l3UA/thumb.jpg?1412476632";
TILE_URLS[TILE_HALL] = "https://s3.amazonaws.com/files.d20.io/images/5831836/5-Y3ZgCb08KkC74lSUagNw/thumb.jpg?1412476626";
TILE_URLS[TILE_CORNER] = "https://s3.amazonaws.com/files.d20.io/images/5831840/odBhXGkwby2-LxmniDeLmA/thumb.jpg?1412476639";

START_URL = "https://s3.amazonaws.com/files.d20.io/images/5832699/smbw3RzDuCfE5H-DjOflEw/thumb.jpg?1412480527";
END_URL = "https://s3.amazonaws.com/files.d20.io/images/5832701/8uNOQn_0uwCGzSWSPAfizg/thumb.jpg?1412480536";

TILE_SIZE = 980;

function rotate(tile, n){ // n*90 degree clockwise rotation
    return (tile >> n) | ((tile << (4 - n)) & 0xf);
}

function hFlip(tile){ // flip tile horizontally: swap two high bits and two low bits
    return ((tile & 0x5) << 1) | ((tile >> 1) & 0x5);
}

function vFlip(tile){ // flip tile vertically: swap two outer bits and two inner bits
    return ((tile & 0x1) << 3) | ((tile >> 3) & 0x1) | ((tile & 0x2) << 1) | ((tile >> 1) & 0x2);
}

function connectionCount(c){
    return (c & FLAG_U ? 1 : 0) + (c & FLAG_R ? 1 : 0) + (c & FLAG_D ? 1 : 0) + (c & FLAG_L ? 1 : 0);
}

function directionsFromMasks(m){
    return (m & MASK_U ? FLAG_U : 0) | (m & MASK_R ? FLAG_R : 0) | (m & MASK_D ? FLAG_D : 0) | (m & MASK_L ? FLAG_L : 0);
}

function trimConnections(grid, x, y){
    // trim rightwards connections from the square to the left of x,y
    if ((x > 0) && (!grid[x - 1][y].filled) && (grid[x - 1][y].connections & FLAG_R)){
	// x-1,y connects to end via x,y; remove that connection
	grid[x - 1][y].connections &= ~FLAG_R;
	if (connectionCount(grid[x - 1][y].connections) <= 1){
	    // removal left x-1,y with at most one connection; this may mean that we got cut off from end; recurse
	    trimConnections(grid, x - 1, y);
	}
    }
    // trim leftwards connections from the square to the right of x,y
    if ((x < grid.length - 1) && (!grid[x + 1][y].filled) && (grid[x + 1][y].connections & FLAG_L)){
	// x+1,y connects to end via x,y; remove that connection
	grid[x + 1][y].connections &= ~FLAG_L;
	if (connectionCount(grid[x + 1][y].connections) <= 1){
	    // removal left x+1,y with at most one connection; this may mean that we got cut off from end; recurse
	    trimConnections(grid, x + 1, y);
	}
    }
    // trim downwards connections from the square above x,y
    if ((y > 0) && (!grid[x][y - 1].filled) && (grid[x][y - 1].connections & FLAG_D)){
	// x,y-1 connects to end via x,y; remove that connection
	grid[x][y - 1].connections &= ~FLAG_D;
	if (connectionCount(grid[x][y - 1].connections) <= 1){
	    // removal left x,y-1 with at most one connection; this may mean that we got cut off from end; recurse
	    trimConnections(grid, x, y - 1);
	}
    }
    // trim upwards connections from the square below x,y
    if ((y < grid[x].length - 1) && (!grid[x][y + 1].filled) && (grid[x][y + 1].connections & FLAG_U)){
	// x,y+1 connects to end via x,y; remove that connection
	grid[x][y + 1].connections &= ~FLAG_U;
	if (connectionCount(grid[x][y + 1].connections) <= 1){
	    // removal left x,y+1 with at most one connection; this may mean that we got cut off from end; recurse
	    trimConnections(grid, x, y + 1);
	}
    }
}

function addSquareToFill(squaresToFill, grid, x, y, direction){
    if ((x < 0) || (x >= grid.length) || (y < 0) || (y >= grid[x].length) || (grid[x][y].filled)){ return; } // outside of grid or already filled
    for (var i = 0; i < squaresToFill.length; i++){
	if ((squaresToFill[i][0] == x) && (squaresToFill[i][1] == y)){
	    // x,y already marked to be filled; add new required connections
	    squaresToFill[i][2] |= (1 << direction);
	    return;
	}
    }
    squaresToFill.push([x, y, (1 << direction)]);
}

function justPlaceTile(workingGrid, finalGrid, squaresToFill, x, y, tile, orientation){
    var conns = directionsFromMasks(rotate(tile, orientation)) & workingGrid[x][y].connections;
    workingGrid[x][y].connections = 0;
    workingGrid[x][y].filled = 1;
    finalGrid[x][y].tile = tile;
    finalGrid[x][y].orientation = orientation;
    return conns;
}

function placeTile(workingGrid, finalGrid, squaresToFill, x, y, tile, orientation){
    var conns = justPlaceTile(workingGrid, finalGrid, squaresToFill, x, y, tile, orientation);
    trimConnections(workingGrid, x, y);
    if (conns & FLAG_L){ addSquareToFill(squaresToFill, workingGrid, x - 1, y, DIRECTION_R); }
    if (conns & FLAG_R){ addSquareToFill(squaresToFill, workingGrid, x + 1, y, DIRECTION_L); }
    if (conns & FLAG_U){ addSquareToFill(squaresToFill, workingGrid, x, y - 1, DIRECTION_D); }
    if (conns & FLAG_D){ addSquareToFill(squaresToFill, workingGrid, x, y + 1, DIRECTION_U); }
}

function candidateValid(workingGrid, finalGrid, x, y, tile, orientation, requiredDirections, possibleConns){
    var tileConns = rotate(tile, orientation);
    var hFlippedTile = hFlip(tileConns);
    var vFlippedTile = vFlip(tileConns);

    // verify candidate tile satisfies all of requiredDirections
    if (requiredDirections & (1 << DIRECTION_L)){
	if (!(hFlippedTile & rotate(finalGrid[x - 1][y].tile, finalGrid[x - 1][y].orientation) & MASK_R)){ return 0; }
    }
    if (requiredDirections & (1 << DIRECTION_R)){
	if (!(hFlippedTile & rotate(finalGrid[x + 1][y].tile, finalGrid[x + 1][y].orientation) & MASK_L)){ return 0; }
    }
    if (requiredDirections & (1 << DIRECTION_U)){
	if (!(vFlippedTile & rotate(finalGrid[x][y - 1].tile, finalGrid[x][y - 1].orientation) & MASK_D)){ return 0; }
    }
    if (requiredDirections & (1 << DIRECTION_D)){
	if (!(vFlippedTile & rotate(finalGrid[x][y + 1].tile, finalGrid[x][y + 1].orientation) & MASK_U)){ return 0; }
    }

    if (!possibleConns){ return 1; } // no outbound paths necessary

    // verify candidate tile satisfies at least one of possibleConns
    if ((possibleConns & (1 << DIRECTION_U)) && (tileConns & MASK_U)){ return 1; }
    if ((possibleConns & (1 << DIRECTION_R)) && (tileConns & MASK_R)){ return 1; }
    if ((possibleConns & (1 << DIRECTION_D)) && (tileConns & MASK_D)){ return 1; }
    if ((possibleConns & (1 << DIRECTION_L)) && (tileConns & MASK_L)){ return 1; }

    // candidate tile does not satisfy any outbound path
    return 0;
}

function fillSquare(workingGrid, finalGrid, squaresToFill, x, y, directions, connected){
    var conns = 0;

    if (!connected){
	// determine if any direction connects directly to end
	if ((x > 0) && (finalGrid[x - 1][y].end)){
	    directions |= FLAG_L;
	    connected = 1;
	}
	if ((x < finalGrid.length - 1) && (finalGrid[x + 1][y].end)){
	    directions |= FLAG_R;
	    connected = 1;
	}
	if ((y > 0) && (finalGrid[x][y - 1].end)){
	    directions |= FLAG_U;
	    connected = 1;
	}
	if ((y < finalGrid[x].length - 1) && (finalGrid[x][y + 1].end)){
	    directions |= FLAG_D;
	    connected = 1;
	}
    }

    if (!connected){
	// determine which directions potentially connect to end
	if ((x > 0) && (!workingGrid[x - 1][y].filled) && (workingGrid[x - 1][y].connections)){ conns |= FLAG_L; }
	if ((x < workingGrid.length - 1) && (!workingGrid[x + 1][y].filled) && (workingGrid[x + 1][y].connections)){ conns |= FLAG_R; }
	if ((y > 0) && (!workingGrid[x][y - 1].filled) && (workingGrid[x][y - 1].connections)){ conns |= FLAG_U; }
	if ((y > workingGrid[x].length - 1) && (!workingGrid[x][y + 1].filled) && (workingGrid[x][y + 1].connections)){ conns |= FLAG_D; }

	// connection only strictly required if we can't make it through some other square
	for (var i = 0; i < squaresToFill.length; i++){
	    if (workingGrid[squaresToFill[i][0]][squaresToFill[i][1]].connections){
		conns = 0;
		break;
	    }
	}
    }

    // determine which tiles could fulfill all our obligations
    var candidates = [];
    for (var i = 0; i < ALL_TILES.length; i++){
	for (var j = 0; j < ALL_DIRECTIONS.length; j++){
	    if (candidateValid(workingGrid, finalGrid, x, y, ALL_TILES[i], ALL_DIRECTIONS[j], directions, conns)){
		candidates.push([ALL_TILES[i], ALL_DIRECTIONS[j]]);
	    }
	}
    }
    //choose tiles which connect in all directions
    if (candidates.length <= 0){
	candidates.push([TILE_BIG_ROOM, 0]);
    }

    // randomly select a candidate tile and place it
    var tileIndex = randomInteger(candidates.length) - 1;
    placeTile(workingGrid, finalGrid, squaresToFill, x, y, candidates[tileIndex][0], candidates[tileIndex][1]);

    return connected;
}

function generateMap(w, h){
    var grid = [];
    var retval = [];
    var squaresToFill = [];
    var startPoint = [];
    var endPoint = [];

    // initialize working and result grids
    for (var i = 0; i < w; i++){
	grid[i] = [];
	retval[i] = [];
	for (var j = 0; j < h; j++){
	    var conns = 0;
	    if (i > 0){ conns |= FLAG_L; }
	    if (i < w - 1){ conns |= FLAG_R; }
	    if (j > 0){ conns |= FLAG_U; }
	    if (j < h - 1){ conns |= FLAG_D; }
	    grid[i][j] = {'connections': conns, 'filled': 0};
	    retval[i][j] = {};
	}
    }

    // place endpoints
    var startPoint = [randomInteger(w) - 1, randomInteger(h) - 1];
    placeTile(grid, retval, squaresToFill, startPoint[0], startPoint[1], TILE_BIG_ROOM, 0);
    retval[startPoint[0]][startPoint[1]].start = 1;
    var endPoint = [randomInteger(w) - 1, randomInteger(h) - 1];
    justPlaceTile(grid, retval, squaresToFill, endPoint[0], endPoint[1], TILE_BIG_ROOM, 0);
    retval[endPoint[0]][endPoint[1]].end = 1;

    // fill the rest of the squares
    var connected = 0;
    while (squaresToFill.length > 0){
	var square = squaresToFill.shift();
	connected = fillSquare(grid, retval, squaresToFill, square[0], square[1], square[2], connected);
    }

    return retval;
}

function handleChatMessage(msg){
    if ((msg.type != "api") || (msg.content.indexOf("!dungen ") != 0)){ return; }

    var tokens = msg.content.split(" ");
    if (tokens.length < 3){ return; }
    
    var tileSize = TILE_SIZE;
    if (tokens.length > 3){ tileSize = tokens[3]; }

    var map = generateMap(tokens[1], tokens[2]);

    for (var i = 0; i < map.length; i++){
	for (var j = 0; j < map[i].length; j++){
	    var tileUrl = TILE_URLS[map[i][j].tile];
	    if (map[i][j].start){ tileUrl = START_URL; }
	    if (map[i][j].end){ tileUrl = END_URL; }
	    if (tileUrl){
		var tile = createObj("graphic", {
						_subtype: "token",
						_pageid: Campaign().get("playerpageid"),
						imgsrc: tileUrl,
						left: (i + 0.5) * tileSize, top: (j + 0.5) * tileSize,
						width: tileSize, height: tileSize,
						rotation: map[i][j].orientation * 90,
						layer: "map"});
	    }
	}
    }
}

on("chat:message", handleChatMessage);