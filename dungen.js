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

DG_OVERLAY_STAIRS_DN = "overlay_stairsdown";
DG_OVERLAY_STAIRS_UP = "overlay_stairsup";
DG_OVERLAY_DOOR = "overlay_door"

var DunGen = DunGen || {
    ALL_DIRECTIONS: [DG_DIRECTION_U, DG_DIRECTION_R, DG_DIRECTION_D, DG_DIRECTION_L],
    ALL_TILES: [DG_TILE_BIG_ROOM, DG_TILE_SMALL_ROOM, DG_TILE_HALL, DG_TILE_CORNER],
    ALL_IMAGES: [DG_TILE_BIG_ROOM, DG_TILE_SMALL_ROOM, DG_TILE_HALL, DG_TILE_CORNER,
		    DG_OVERLAY_STAIRS_DN, DG_OVERLAY_STAIRS_UP, DG_OVERLAY_DOOR],

    TILE_NAMES: {},
    TILE_DESCS: {},

    TILE_SIZE: 980,

    DOOR_TILE_WIDTH: 350,
    DOOR_TILE_HEIGHT: 140,
    DOOR_OFFSET: 210,
    DOOR_WIDTH: 140,

    MIN_LINE_WIDTH: 2,

    GRID_SIZE: 70,

    init: function(){
	DunGen.TILE_NAMES[DG_TILE_BIG_ROOM]	= "BigRoom";
	DunGen.TILE_NAMES[DG_TILE_SMALL_ROOM]	= "SmallRoom";
	DunGen.TILE_NAMES[DG_TILE_HALL]		= "Hall";
	DunGen.TILE_NAMES[DG_TILE_CORNER]	= "Corner";

	DunGen.TILE_NAMES[DG_OVERLAY_STAIRS_DN]	= "StairsDown";
	DunGen.TILE_NAMES[DG_OVERLAY_STAIRS_UP]	= "StairsUp";
	DunGen.TILE_NAMES[DG_OVERLAY_DOOR]	= "Door";

	DunGen.TILE_DESCS[DG_TILE_BIG_ROOM]	= "Room which spans full tile";
	DunGen.TILE_DESCS[DG_TILE_SMALL_ROOM]	= "Room in upper-left quarter of tile";
	DunGen.TILE_DESCS[DG_TILE_HALL]		= "Hallway which spans left half of tile";
	DunGen.TILE_DESCS[DG_TILE_CORNER]	= "Hallway corner which spans right and bottom three-quarters of tile";

	DunGen.TILE_DESCS[DG_OVERLAY_STAIRS_DN]	= "Full-tile sized overlay which includes stairs down from end room";
	DunGen.TILE_DESCS[DG_OVERLAY_STAIRS_UP]	= "Full-tile sized overlay which includes stairs up from start room";
	DunGen.TILE_DESCS[DG_OVERLAY_DOOR]	= "Reduced-size overlay which contains a door (possibly embedded in a wall)";

	if (!state.hasOwnProperty('DunGen')){
	    state.DunGen = { 'sparse': true };
	}
	if (!state.DunGen.TILE_URLS){ state.DunGen.TILE_URLS = {}; }
    },

    rawWrite: function(s, who, style, from){
	if (who){
	    who = "/w " + who.split(" ", 1)[0] + " ";
	}
	sendChat(from, who + s.replace(/\n/g, "<br>"));
    },

    write: function(s, who, style, from){
	DunGen.rawWrite(s.replace(/</g, "&lt;").replace(/>/g, "&gt;"), who, style, from);
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
	var conns = DunGen.directionsFromMasks(DunGen.rotate(tile, orientation));
	if (state.DunGen.sparse){ conns &= workingGrid[x][y].connections; }
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
	while ((endPoint[0] == startPoint[0]) && (endPoint[1] == startPoint[1])){
	    // make sure end point isn't same as start point (guaranteed possible because we aborted above if total map area was one or fewer squares)
	    endPoint = [randomInteger(w) - 1, randomInteger(h) - 1];
	}
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

    showHelp: function(who, cmd){
	DunGen.write(cmd + " WIDTH HEIGHT [TILE SIZE]", who, "", "DunGen");
	var helpMsg = "Generate a WIDTHxHEIGHT dungeon from square tiles of the specified size (in pixels)\n";
	helpMsg += "TILE SIZE defaults to " + DunGen.TILE_SIZE + "; it should generally be a multiple of " + DunGen.GRID_SIZE;
	DunGen.write(helpMsg, who, "font-size: small; font-family: monospace", "DunGen");
	DunGen.write(cmd + " sparse [on|off]", who, "", "DunGen");
	helpMsg = "Display or set status of sparse map generation\n";
	helpMsg += "If sparse is on, no tiles will be added to paths which cannot connect to the exit";
	DunGen.write(helpMsg, who, "font-size: small; font-family: monospace", "DunGen");
	DunGen.write(cmd + " setimage TILE_NAME", who, "", "DunGen");
	helpMsg = "Use selected token's image for the specified tile";
	DunGen.write(helpMsg, who, "font-size: small; font-family: monospace", "DunGen");
	DunGen.write(cmd + " tiles", who, "", "DunGen");
	helpMsg = "Show list of tiles, their sizes, and a description of each";
	DunGen.write(helpMsg, who, "font-size: small; font-family: monospace", "DunGen");
    },

    mapConns: function(map, x, y){
	return DunGen.rotate(map[x][y].tile, map[x][y].orientation);
    },

    handleDungenMessage: function(tokens, msg){
	var who = msg.who;

	if ((tokens.length < 2) || (tokens[1] == "help")){ return DunGen.showHelp(who, tokens[0]); }

	if (tokens[1] == "sparse"){
	    if (tokens.length > 2){
		// set sparse status
		if ((tokens[2] == "on") || (tokens[2] == "yes") || (tokens[2] == "true") || (tokens[2] == "1")){ state.DunGen.sparse = true; }
		else{ state.DunGen.sparse = false; }
	    }
	    // show sparse status
	    DunGen.write("Sparse Map Generation: " + (state.DunGen.sparse ? "on" : "off"), who, "", "DunGen");
	    return;
	}

	if (tokens[1] == "tiles"){
	    function showTileDesc(tile, sizeStr){
		DunGen.rawWrite("<b>" + DunGen.TILE_NAMES[tile] + "</b> " + sizeStr + ":\n\t" + DunGen.TILE_DESCS[tile], who, "", "DunGen");
	    }
	    var tileSize = "(" + DunGen.TILE_SIZE + " x " + DunGen.TILE_SIZE + ")";
	    for (var i = 0; i < DunGen.ALL_TILES.length; i++){
		showTileDesc(DunGen.ALL_TILES[i], tileSize);
	    }
	    showTileDesc(DG_OVERLAY_STAIRS_DN, tileSize);
	    showTileDesc(DG_OVERLAY_STAIRS_UP, tileSize);
	    showTileDesc(DG_OVERLAY_DOOR, "(" + DunGen.DOOR_TILE_WIDTH + " x " + DunGen.DOOR_TILE_HEIGHT + ")");
	    return;
	}

	if (tokens.length < 3){ return DunGen.showHelp(who, tokens[0]); }

	if (tokens[1] == "setimage"){
	    if ((!msg.selected) || (msg.selected.length != 1) || (msg.selected[0]._type != "graphic")){
		DunGen.write("Error: setimage requires exactly one selected token", who, "", "DunGen");
		return;
	    }
	    var imgToken = getObj(msg.selected[0]._type, msg.selected[0]._id);
	    if (!imgToken){
		DunGen.write("Error: Unable to get selected token", who, "", "DunGen");
		return;
	    }
	    var imgUrl = imgToken.get('imgsrc').replace(/[/][^/.]*[.](jpg|png)/, "/thumb.$1");
	    var tile;
	    for (var i = 0; i < DunGen.ALL_IMAGES.length; i++){
		if (DunGen.TILE_NAMES[DunGen.ALL_IMAGES[i]] == tokens[2]){
		    tile = DunGen.ALL_IMAGES[i];
		    break;
		}
	    }
	    if (!tile){
		DunGen.write("Error: Unrecognized tile/overlay: " + tokens[2], who, "", "DunGen");
		return;
	    }
	    state.DunGen.TILE_URLS[tile] = imgUrl;
	    DunGen.write("Set image for tile '" + DunGen.TILE_NAMES[tile] + "' to " + imgUrl, who, "", "DunGen");
	    return;
	}

	var imagesNeeded = [];
	for (var i = 0; i < DunGen.ALL_IMAGES.length; i++){
	    if (!state.DunGen.TILE_URLS[DunGen.ALL_IMAGES[i]]){
		imagesNeeded.push(DunGen.TILE_NAMES[DunGen.ALL_IMAGES[i]]);
	    }
	}
	if (imagesNeeded.length > 0){
	    imagesNeeded.sort();
	    DunGen.write("Image not set for following tiles/overlays: " + imagesNeeded.join(", "), who, "", "DunGen");
	    DunGen.write('Set by selecting image and issuing "!dungen setimage IMAGE_NAME" command', who, "", "DunGen");
	    return;
	}

	var width = parseInt(tokens[1]);
	var height = parseInt(tokens[2]);

	if (width * height <= 1){
	    DunGen.write("Error: Map must be larger than 1x1", who, "", "DunGen");
	    return;
	}
    
	var tileSize = DunGen.TILE_SIZE;
	if (tokens.length > 3){ tileSize = parseInt(tokens[3]); }
	if (tileSize < 2){
	    DunGen.write("Error: Tile size must be at least 2", who, "", "DunGen");
	    return;
	}

	var doorTileWidth = DunGen.DOOR_TILE_WIDTH * tileSize;
	var doorTileHeight = DunGen.DOOR_TILE_HEIGHT * tileSize;
	var doorOffset = DunGen.DOOR_OFFSET * tileSize;
	var doorWidth = DunGen.DOOR_WIDTH * tileSize;

	// make sure generated map will fit on page
	var pageId = Campaign().get('playerpageid');
	if (!pageId){
	    DunGen.write("Error: Unable to determine player page", who, "", "DunGen");
	    return;
	}
	var page = getObj("page", pageId);
	if (!page){
	    DunGen.write("Error: Unable to get player page", who, "", "DunGen");
	    return;
	}
	if ((width * tileSize > Campaign().get('width') * DunGen.GRID_SIZE) || (height * tileSize > Campaign().get('height') * DunGen.GRID_SIZE)){
	    var errMsg = "Error: Map size (" + (width * tileSize) + " x " + (height * tileSize) + ") larger than page size (";
	    errMsg += (Campaign().get('width') * DunGen.GRID_SIZE) + " x " + (Campaign().get('height') * DunGen.GRID_SIZE) + ")";
	    DunGen.write(errMsg, who, "", "DunGen");
	    return;
	}

	if (tokens.length > 4){ DunGen.write("Warning: Ignoring extra args: " + tokens.slice(4).join(" "), who, "", "DunGen"); }

	if (tileSize % DunGen.GRID_SIZE != 0){
	    var errMsg = "Warning: Tile size (" + tileSize + ") not a multiple of grid size (" + DunGen.GRID_SIZE + ")";
	    DunGen.write(errMsg, who, "", "DunGen");
	}

	if ((doorTileWidth % DunGen.TILE_SIZE != 0) || (doorTileHeight % DunGen.TILE_SIZE != 0)){
	    DunGen.write("Warning: Door size is not an integer for this tile size; door position may not be pixel-perfect", who, "", "DunGen");
	}
	doorTileWidth /= DunGen.TILE_SIZE;
	doorTileHeight /= DunGen.TILE_SIZE;
	doorOffset /= DunGen.TILE_SIZE;
	doorWidth /= DunGen.TILE_SIZE;

	var map = DunGen.generateMap(width, height);

	for (var i = 0; i < map.length; i++){
	    for (var j = 0; j < map[i].length; j++){
		var tileUrl = state.DunGen.TILE_URLS[map[i][j].tile];
		if ((map[i][j].start) || (map[i][j].end)){
		    tileUrl = state.DunGen.TILE_URLS[DG_TILE_BIG_ROOM];
		    map[i][j].orientation = 0;
		}
		if (tileUrl){
		    var tile = createObj("graphic", {
						    _subtype: "token",
						    _pageid: pageId,
						    imgsrc: tileUrl,
						    left: (i + 0.5) * tileSize, top: (j + 0.5) * tileSize,
						    width: tileSize, height: tileSize,
						    rotation: map[i][j].orientation * 90,
						    layer: "map"});
		    if (map[i][j].start){
			// add stairs down
			tile = createObj("graphic", {
						    _subtype: "token",
						    _pageid: pageId,
						    imgsrc: state.DunGen.TILE_URLS[DG_OVERLAY_STAIRS_DN],
						    left: (i + 0.5) * tileSize, top: (j + 0.5) * tileSize,
						    width: tileSize, height: tileSize,
						    layer: "map"});
		    }
		    if (map[i][j].end){
			// add stairs up
			tile = createObj("graphic", {
						    _subtype: "token",
						    _pageid: pageId,
						    imgsrc: state.DunGen.TILE_URLS[DG_OVERLAY_STAIRS_UP],
						    left: (i + 0.5) * tileSize, top: (j + 0.5) * tileSize,
						    width: tileSize, height: tileSize,
						    layer: "map"});
		    }
		    // add doors where appropriate
		    var conns = DunGen.mapConns(map, i, j);
		    var doors = [];
		    if (j > 0){
			// check upwards
			if ((conns & DG_CONNECTION_UL) && (DunGen.mapConns(map, i, j - 1) & DG_CONNECTION_DL)){
			    // upper left: not rotated, not flipped
			    doors.push([0, false, 0.5 * doorTileWidth, 0.5 * doorTileHeight]);
			}
			if ((conns & DG_CONNECTION_UR) && (DunGen.mapConns(map, i, j - 1) & DG_CONNECTION_DR)){
			    // upper right: not rotated, flipped
			    doors.push([0, true, tileSize - 0.5 * doorTileWidth, 0.5 * doorTileHeight]);
			}
		    }
		    if (i < map.length - 1){
			// check right
			if ((conns & DG_CONNECTION_UR) && (DunGen.mapConns(map, i + 1, j) & DG_CONNECTION_UL)){
			    // right upper: rotated one step, not flipped
			    doors.push([1, false, tileSize - 0.5 * doorTileHeight, 0.5 * doorTileWidth]);
			}
			if ((conns & DG_CONNECTION_DR) && (DunGen.mapConns(map, i + 1, j) & DG_CONNECTION_DL)){
			    // right lower: rotated one step, flipped
			    doors.push([1, true, tileSize - 0.5 * doorTileHeight, tileSize - 0.5 * doorTileWidth]);
			}
		    }
		    if (j < map[i].length - 1){
			// check downwards
			if ((conns & DG_CONNECTION_DR) && (DunGen.mapConns(map, i, j + 1) & DG_CONNECTION_UR)){
			    // lower right: rotated two steps, not flipped
			    doors.push([2, false, tileSize - 0.5 * doorTileWidth, tileSize - 0.5 * doorTileHeight]);
			}
			if ((conns & DG_CONNECTION_DL) && (DunGen.mapConns(map, i, j + 1) & DG_CONNECTION_UL)){
			    // lower left: rotated two steps, flipped
			    doors.push([2, true, 0.5 * doorTileWidth, tileSize - 0.5 * doorTileHeight]);
			}
		    }
		    if (i > 0){
			// check left
			if ((conns & DG_CONNECTION_DL) && (DunGen.mapConns(map, i - 1, j) & DG_CONNECTION_DR)){
			    // left lower: rotated three steps, not flipped
			    doors.push([3, false, 0.5 * doorTileHeight, tileSize - 0.5 * doorTileWidth]);
			}
			if ((conns & DG_CONNECTION_UL) && (DunGen.mapConns(map, i - 1, j) & DG_CONNECTION_UR)){
			    // left upper: rotated three steps, flipped
			    doors.push([3, true, 0.5 * doorTileHeight, 0.5 * doorTileWidth]);
			}
		    }
		    for (var k = 0; k < doors.length; k++){
			tile = createObj("graphic", {
						    _subtype: "token",
						    _pageid: pageId,
						    imgsrc: state.DunGen.TILE_URLS[DG_OVERLAY_DOOR],
						    left: i * tileSize + doors[k][2],
						    top: j * tileSize + doors[k][3],
						    width: doorTileWidth, height: doorTileHeight,
						    rotation: doors[k][0] * 90,
						    fliph: doors[k][1],
						    layer: "map"});
		    }
		    // draw dynamic lighting walls
		    var offsets = [0, doorOffset, doorOffset + doorWidth, tileSize - doorOffset - doorWidth, tileSize - doorOffset, tileSize];
		    var lineWidth = Math.floor(tileSize / 14);
		    if (lineWidth < DunGen.MIN_LINE_WIDTH){ lineWidth = DunGen.MIN_LINE_WIDTH; }
		    if (i > 0){
			// draw along left
			var pathArray = [["M", 0, 0], ["L", lineWidth, 0], ["L", lineWidth, offsets[1]], ["L", 0, offsets[1]], ["L", 0, 0]];
			for (var k = 1; k < offsets.length; k++){
			    var l = offsets[k] - offsets[k - 1];
			    pathArray[2][2] = l;
			    pathArray[3][2] = l;
			    var color = (k % 2 ? "#ffff00" : "#00ff00");
			    var path = createObj("path", {
							_pageid: pageId,
							_path: JSON.stringify(pathArray),
							stroke: color,
							fill: color,
							stroke_width: 1,
							left: i * tileSize, top: j * tileSize + offsets[k - 1] + 0.5 * l,
							width: lineWidth, height: l,
							layer: "walls"});
			}
		    }
		    if (j > 0){
			// draw along top
			var pathArray = [["M", 0, 0], ["L", 0, lineWidth], ["L", offsets[1], lineWidth], ["L", offsets[1], 0], ["L", 0, 0]];
			for (var k = 1; k < offsets.length; k++){
			    var l = offsets[k] - offsets[k - 1];
			    pathArray[2][1] = l;
			    pathArray[3][1] = l;
			    var color = (k % 2 ? "#ffff00" : "#00ff00");
			    var path = createObj("path", {
							_pageid: pageId,
							_path: JSON.stringify(pathArray),
							stroke: color,
							fill: color,
							stroke_width: 1,
							left: i * tileSize + offsets[k - 1] + 0.5 * l, top: j * tileSize,
							width: l, height: lineWidth,
							layer: "walls"});
			}
		    }
		}
	    }
	}
    },

    handleChatMessage: function(msg){
	if ((msg.type != "api") || ((msg.content != "!dungen") && (msg.content.indexOf("!dungen") != 0))){ return; }

	return DunGen.handleDungenMessage(msg.content.split(" "), msg);
    },

    registerDunGen: function(){
	DunGen.init();
	if ((typeof(Shell) != "undefined") && (Shell) && (Shell.registerCommand)){
	    Shell.registerCommand("!dungen", "!dungen <width> <height> [size]", "Generate a width x height random dungeon", DunGen.handleDungenMessage);
	    if (Shell.rawWrite){ DunGen.rawWrite = Shell.rawWrite; }
	    if (Shell.write){ DunGen.write = Shell.write; }
	}
	else{
	    on("chat:message", DunGen.handleChatMessage);
	}
    }
};

on("ready", function(){ DunGen.registerDunGen(); });
