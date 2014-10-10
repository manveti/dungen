DG_CONNECTION_UL = 1<<3;
DG_CONNECTION_UR = 1<<2;
DG_CONNECTION_DR = 1<<1;
DG_CONNECTION_DL = 1<<0;

DG_MASK_U = DG_CONNECTION_UL | DG_CONNECTION_UR;
DG_MASK_R = DG_CONNECTION_UR | DG_CONNECTION_DR;
DG_MASK_D = DG_CONNECTION_DR | DG_CONNECTION_DL;
DG_MASK_L = DG_CONNECTION_DL | DG_CONNECTION_UL;

DG_DIRECTION_U = 0;
DG_DIRECTION_R = 1;
DG_DIRECTION_D = 2;
DG_DIRECTION_L = 3;

DG_FLAG_U = 1 << DG_DIRECTION_U;
DG_FLAG_R = 1 << DG_DIRECTION_R;
DG_FLAG_D = 1 << DG_DIRECTION_D;
DG_FLAG_L = 1 << DG_DIRECTION_L;

DG_TILE_BIG_ROOM	= DG_CONNECTION_UL | DG_CONNECTION_UR | DG_CONNECTION_DR | DG_CONNECTION_DL;
DG_TILE_SMALL_ROOM	= DG_CONNECTION_UL;
DG_TILE_HALL		= DG_CONNECTION_UL | DG_CONNECTION_DL;
DG_TILE_CORNER		= DG_CONNECTION_UR | DG_CONNECTION_DR | DG_CONNECTION_DL;

var DunGen = DunGen || {
    ALL_DIRECTIONS: [DG_DIRECTION_U, DG_DIRECTION_R, DG_DIRECTION_D, DG_DIRECTION_L],
    ALL_TILES: [DG_TILE_BIG_ROOM, DG_TILE_SMALL_ROOM, DG_TILE_HALL, DG_TILE_CORNER],

    TILE_URLS: {},

    TILE_SIZE: 980,

    init: function(){
	DunGen.TILE_URLS[DG_TILE_BIG_ROOM] = "https://s3.amazonaws.com/files.d20.io/images/5831842/UeVYJBAl-eAse6nV5K4tlw/thumb.jpg?1412476647";
	DunGen.TILE_URLS[DG_TILE_SMALL_ROOM] = "https://s3.amazonaws.com/files.d20.io/images/5831838/q_qYBvd7x7dSp9gSU6l3UA/thumb.jpg?1412476632";
	DunGen.TILE_URLS[DG_TILE_HALL] = "https://s3.amazonaws.com/files.d20.io/images/5831836/5-Y3ZgCb08KkC74lSUagNw/thumb.jpg?1412476626";
	DunGen.TILE_URLS[DG_TILE_CORNER] = "https://s3.amazonaws.com/files.d20.io/images/5831840/odBhXGkwby2-LxmniDeLmA/thumb.jpg?1412476639";

	DunGen.START_URL = "https://s3.amazonaws.com/files.d20.io/images/5832699/smbw3RzDuCfE5H-DjOflEw/thumb.jpg?1412480527";
	DunGen.END_URL = "https://s3.amazonaws.com/files.d20.io/images/5832701/8uNOQn_0uwCGzSWSPAfizg/thumb.jpg?1412480536";
    },

    rotate: function(tile, n){ // n*90 degree clockwise rotation
	return (tile >> n) | ((tile << (4 - n)) & 0xf);
    },

    hFlip: function(tile){ // flip tile horizontally: swap two high bits and two low bits
	return ((tile & 0x5) << 1) | ((tile >> 1) & 0x5);
    },

    vFlip: function(tile){ // flip tile vertically: swap two outer bits and two inner bits
	return ((tile & 0x1) << 3) | ((tile >> 3) & 0x1) | ((tile & 0x2) << 1) | ((tile >> 1) & 0x2);
    },

    connectionCount: function(c){
	return (c & DG_FLAG_U ? 1 : 0) + (c & DG_FLAG_R ? 1 : 0) + (c & DG_FLAG_D ? 1 : 0) + (c & DG_FLAG_L ? 1 : 0);
    },

    directionsFromMasks: function(m){
	return (m & DG_MASK_U ? DG_FLAG_U : 0) | (m & DG_MASK_R ? DG_FLAG_R : 0) | (m & DG_MASK_D ? DG_FLAG_D : 0) | (m & DG_MASK_L ? DG_FLAG_L : 0);
    },

    trimConnections: function(grid, x, y){
	// trim rightwards connections from the square to the left of x,y
	if ((x > 0) && (!grid[x - 1][y].filled) && (grid[x - 1][y].connections & DG_FLAG_R)){
	    // x-1,y connects to end via x,y; remove that connection
	    grid[x - 1][y].connections &= ~DG_FLAG_R;
	    if (DunGen.connectionCount(grid[x - 1][y].connections) <= 1){
		// removal left x-1,y with at most one connection; this may mean that we got cut off from end; recurse
		DunGen.trimConnections(grid, x - 1, y);
	    }
	}
	// trim leftwards connections from the square to the right of x,y
	if ((x < grid.length - 1) && (!grid[x + 1][y].filled) && (grid[x + 1][y].connections & DG_FLAG_L)){
	    // x+1,y connects to end via x,y; remove that connection
	    grid[x + 1][y].connections &= ~DG_FLAG_L;
	    if (DunGen.connectionCount(grid[x + 1][y].connections) <= 1){
		// removal left x+1,y with at most one connection; this may mean that we got cut off from end; recurse
		DunGen.trimConnections(grid, x + 1, y);
	    }
	}
	// trim downwards connections from the square above x,y
	if ((y > 0) && (!grid[x][y - 1].filled) && (grid[x][y - 1].connections & DG_FLAG_D)){
	    // x,y-1 connects to end via x,y; remove that connection
	    grid[x][y - 1].connections &= ~DG_FLAG_D;
	    if (DunGen.connectionCount(grid[x][y - 1].connections) <= 1){
		// removal left x,y-1 with at most one connection; this may mean that we got cut off from end; recurse
		DunGen.trimConnections(grid, x, y - 1);
	    }
	}
	// trim upwards connections from the square below x,y
	if ((y < grid[x].length - 1) && (!grid[x][y + 1].filled) && (grid[x][y + 1].connections & DG_FLAG_U)){
	    // x,y+1 connects to end via x,y; remove that connection
	    grid[x][y + 1].connections &= ~DG_FLAG_U;
	    if (DunGen.connectionCount(grid[x][y + 1].connections) <= 1){
		// removal left x,y+1 with at most one connection; this may mean that we got cut off from end; recurse
		DunGen.trimConnections(grid, x, y + 1);
	    }
	}
    },

    addSquareToFill: function(squaresToFill, grid, x, y, direction){
	if ((x < 0) || (x >= grid.length) || (y < 0) || (y >= grid[x].length) || (grid[x][y].filled)){ return; } // outside of grid or already filled
	for (var i = 0; i < squaresToFill.length; i++){
	    if ((squaresToFill[i][0] == x) && (squaresToFill[i][1] == y)){
		// x,y already marked to be filled; add new required connections
		squaresToFill[i][2] |= (1 << direction);
		return;
	    }
	}
	squaresToFill.push([x, y, (1 << direction)]);
    },

    justPlaceTile: function(workingGrid, finalGrid, squaresToFill, x, y, tile, orientation){
	var conns = DunGen.directionsFromMasks(DunGen.rotate(tile, orientation)) & workingGrid[x][y].connections;
	workingGrid[x][y].connections = 0;
	workingGrid[x][y].filled = 1;
	finalGrid[x][y].tile = tile;
	finalGrid[x][y].orientation = orientation;
	return conns;
    },

    placeTile: function(workingGrid, finalGrid, squaresToFill, x, y, tile, orientation){
	var conns = DunGen.justPlaceTile(workingGrid, finalGrid, squaresToFill, x, y, tile, orientation);
	DunGen.trimConnections(workingGrid, x, y);
	if (conns & DG_FLAG_L){ DunGen.addSquareToFill(squaresToFill, workingGrid, x - 1, y, DG_DIRECTION_R); }
	if (conns & DG_FLAG_R){ DunGen.addSquareToFill(squaresToFill, workingGrid, x + 1, y, DG_DIRECTION_L); }
	if (conns & DG_FLAG_U){ DunGen.addSquareToFill(squaresToFill, workingGrid, x, y - 1, DG_DIRECTION_D); }
	if (conns & DG_FLAG_D){ DunGen.addSquareToFill(squaresToFill, workingGrid, x, y + 1, DG_DIRECTION_U); }
    },

    candidateValid: function(workingGrid, finalGrid, x, y, tile, orientation, requiredDirections, possibleConns){
	var tileConns = DunGen.rotate(tile, orientation);
	var hFlippedTile = DunGen.hFlip(tileConns);
	var vFlippedTile = DunGen.vFlip(tileConns);

	// verify candidate tile satisfies all of requiredDirections
	if (requiredDirections & (1 << DG_DIRECTION_L)){
	    if (!(hFlippedTile & DunGen.rotate(finalGrid[x - 1][y].tile, finalGrid[x - 1][y].orientation) & DG_MASK_R)){ return 0; }
	}
	if (requiredDirections & (1 << DG_DIRECTION_R)){
	    if (!(hFlippedTile & DunGen.rotate(finalGrid[x + 1][y].tile, finalGrid[x + 1][y].orientation) & DG_MASK_L)){ return 0; }
	}
	if (requiredDirections & (1 << DG_DIRECTION_U)){
	    if (!(vFlippedTile & DunGen.rotate(finalGrid[x][y - 1].tile, finalGrid[x][y - 1].orientation) & DG_MASK_D)){ return 0; }
	}
	if (requiredDirections & (1 << DG_DIRECTION_D)){
	    if (!(vFlippedTile & DunGen.rotate(finalGrid[x][y + 1].tile, finalGrid[x][y + 1].orientation) & DG_MASK_U)){ return 0; }
	}

	if (!possibleConns){ return 1; } // no outbound paths necessary

	// verify candidate tile satisfies at least one of possibleConns
	if ((possibleConns & (1 << DG_DIRECTION_U)) && (tileConns & DG_MASK_U)){ return 1; }
	if ((possibleConns & (1 << DG_DIRECTION_R)) && (tileConns & DG_MASK_R)){ return 1; }
	if ((possibleConns & (1 << DG_DIRECTION_D)) && (tileConns & DG_MASK_D)){ return 1; }
	if ((possibleConns & (1 << DG_DIRECTION_L)) && (tileConns & DG_MASK_L)){ return 1; }

	// candidate tile does not satisfy any outbound path
	return 0;
    },

    fillSquare: function(workingGrid, finalGrid, squaresToFill, x, y, directions, connected){
	var conns = 0;

	if (!connected){
	    // determine if any direction connects directly to end
	    if ((x > 0) && (finalGrid[x - 1][y].end)){
		directions |= DG_FLAG_L;
		connected = 1;
	    }
	    if ((x < finalGrid.length - 1) && (finalGrid[x + 1][y].end)){
		directions |= DG_FLAG_R;
		connected = 1;
	    }
	    if ((y > 0) && (finalGrid[x][y - 1].end)){
		directions |= DG_FLAG_U;
		connected = 1;
	    }
	    if ((y < finalGrid[x].length - 1) && (finalGrid[x][y + 1].end)){
		directions |= DG_FLAG_D;
		connected = 1;
	    }
	}

	if (!connected){
	    // determine which directions potentially connect to end
	    if ((x > 0) && (!workingGrid[x - 1][y].filled) && (workingGrid[x - 1][y].connections)){ conns |= DG_FLAG_L; }
	    if ((x < workingGrid.length - 1) && (!workingGrid[x + 1][y].filled) && (workingGrid[x + 1][y].connections)){ conns |= DG_FLAG_R; }
	    if ((y > 0) && (!workingGrid[x][y - 1].filled) && (workingGrid[x][y - 1].connections)){ conns |= DG_FLAG_U; }
	    if ((y > workingGrid[x].length - 1) && (!workingGrid[x][y + 1].filled) && (workingGrid[x][y + 1].connections)){ conns |= DG_FLAG_D; }

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
	for (var i = 0; i < DunGen.ALL_TILES.length; i++){
	    for (var j = 0; j < DunGen.ALL_DIRECTIONS.length; j++){
		if (DunGen.candidateValid(workingGrid, finalGrid, x, y, DunGen.ALL_TILES[i], DunGen.ALL_DIRECTIONS[j], directions, conns)){
		    candidates.push([DunGen.ALL_TILES[i], DunGen.ALL_DIRECTIONS[j]]);
		}
	    }
	}
	//choose tiles which connect in all directions
	if (candidates.length <= 0){
	    candidates.push([DG_TILE_BIG_ROOM, 0]);
	}

	// randomly select a candidate tile and place it
	var tileIndex = randomInteger(candidates.length) - 1;
	DunGen.placeTile(workingGrid, finalGrid, squaresToFill, x, y, candidates[tileIndex][0], candidates[tileIndex][1]);

	return connected;
    },

    generateMap: function(w, h){
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
		if (i > 0){ conns |= DG_FLAG_L; }
		if (i < w - 1){ conns |= DG_FLAG_R; }
		if (j > 0){ conns |= DG_FLAG_U; }
		if (j < h - 1){ conns |= DG_FLAG_D; }
		grid[i][j] = {'connections': conns, 'filled': 0};
		retval[i][j] = {};
	    }
	}

	// place endpoints
	var startPoint = [randomInteger(w) - 1, randomInteger(h) - 1];
	DunGen.placeTile(grid, retval, squaresToFill, startPoint[0], startPoint[1], DG_TILE_BIG_ROOM, 0);
	retval[startPoint[0]][startPoint[1]].start = 1;
	var endPoint = [randomInteger(w) - 1, randomInteger(h) - 1];
	DunGen.justPlaceTile(grid, retval, squaresToFill, endPoint[0], endPoint[1], DG_TILE_BIG_ROOM, 0);
	retval[endPoint[0]][endPoint[1]].end = 1;

	// fill the rest of the squares
	var connected = 0;
	while (squaresToFill.length > 0){
	    var square = squaresToFill.shift();
	    connected = DunGen.fillSquare(grid, retval, squaresToFill, square[0], square[1], square[2], connected);
	}

	return retval;
    },

    showHelp: function(cmd){
	sendChat("DunGen", cmd + " WIDTH HEIGHT [TILE SIZE]");
	sendChat("DunGen", "Generate a WIDTHxHEIGHT dungeon from square tiles of the specified size (in pixels)");
    },

    handleChatMessage: function(msg){
	if ((msg.type != "api") || (msg.content.indexOf("!dungen ") != 0)){ return; }

	var tokens = msg.content.split(" ");
	if ((tokens.length < 3) || (tokens[1] == "help")){ return DunGen.showHelp(tokens[0]); }
    
	var tileSize = DunGen.TILE_SIZE;
	if (tokens.length > 3){ tileSize = tokens[3]; }

	if (tokens.length > 4){ sendChat("DunGen", "Warning: Ignoring extra args: " + tokens.slice(4).join(" ")); }

	var map = DunGen.generateMap(tokens[1], tokens[2]);

	for (var i = 0; i < map.length; i++){
	    for (var j = 0; j < map[i].length; j++){
		var tileUrl = DunGen.TILE_URLS[map[i][j].tile];
		if (map[i][j].start){ tileUrl = DunGen.START_URL; }
		if (map[i][j].end){ tileUrl = DunGen.END_URL; }
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
    },

    registerDunGen: function(){
	DunGen.init();
	on("chat:message", DunGen.handleChatMessage);
    }
};

on("ready", function(){ DunGen.registerDunGen(); });