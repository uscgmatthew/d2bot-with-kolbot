/**	
*	@author			Adhd
*	@lastUpdate		02/17/15 14:38 ALASKAN Time
*	@filename		GameManager.js (goes in tools folder)
*
*	Instructions at: http://pastebin.com/pRDdDq0E
*/

// Set the variables below
var standAloneScript = false, // Turn this on if you are using it by itself without a script designed for it!
	autoLogoutTime = 10, // Auto logout when inactive for this many minutes
	logoutOnExit = true, // Logout users when they leave battle.net
	updateInterval = 120, // Minimum update interval in seconds for JSON file updates
	minGameTime = 60,	// Minimum game time in seconds to record as a completed game
	delayBetweenCmds = 2, // Delay between verbal commands
	announceGames = true, // announce games when they join a new game and finish a game
	clearFriendsList = true, // Clear friends list when we first login
	debug = true,	// Turn on debug printouts in d2bs console
	adminTrig = "!", // trigger for admin type commands	
	gameTypes = ["baal", "chaos", "rush", "xfer", "mf"], // Put all types of games you use here

// DO NOT EDIT BELOW THIS LINE_____________________________________________
storedInfo = {
	create: function () {
		var obj, string;

		obj = {
			runners: {},
			adminList: [],
			banList: [],
			topFive: {}
		};

		string = JSON.stringify(obj);
		FileTools.writeText('Profiles/' + "GM_" + me.profile + ".json", string);
	},

	read: function (profile) {
		var obj, string;
		
		if (!profile) {
			profile = me.profile;
		}
		
		string = FileTools.readText('Profiles/' + "GM_" + profile + ".json");
		obj = JSON.parse(string);

		return obj;
	},

	write: function (obj) {
		var string;

		string = JSON.stringify(obj);
		FileTools.writeText('Profiles/' + "GM_" + me.profile + ".json", string);
	}
},

commands = ["login", "logout", "stats", "top", "games", "announce", "help", "addRunner", "removeRunner", "addAdmin", "removeAdmin", "listAdmins", "listRunners", "kick", "ban", "unban"],
info, textOnScreen, words, updateVariables, starter, 
lastAction = getTickCount(),
getGameName = [],
thingsToDo = [],
adminList = [],
loggedIn = [],
topFive = {},
banList = [],
runners = {},
inGame = [],
index = 0;

function msg(msg, nick) {
	var fullMsg = msg;
	
	if (nick) {
		fullMsg = "/w " + nick + " " + msg;
	}	
	
	say (fullMsg);
	
	return true;
};
	
function main() {
	this.debug = function(string) {
		if (debug) {
			print (string);
		}
		return true;
	};
	
	this.ChatEvent = function (nick, msg) {
		var command, spot, split, param, cmd, i,
		actions = ["entered a", "has exited", "has entered", "joined the channel"];
		
		if (msg) {
			nick = nick.toLowerCase().split("*");
			msg = msg.toLowerCase();
			
			for (i = 0; i < commands.length; i++) {
				if (msg.match(adminTrig + commands[i].toLowerCase())) {
					command = commands[i];
					
					split = msg.split(" ");
					spot = split.indexOf(adminTrig + command.toLowerCase());
					spot++;
				
					if (split[spot]) {	
						param = split[spot];
					}								
				}
			}
			
			if (loggedIn.indexOf(nick[0]) > -1) {
				for (i = 0; i < actions.length; i++) {
					if (msg.match(actions[i])) {
						command = actions[i];
					}
				}
			}
			
			if (msg.match("help")) {
				command = "help";
			}
			
			switch (command) {
			case "entered a":
				command = "joinedGame";
				param = msg;
				break;
				
			case "has exited":
				command = "leftBnet";
				param = msg;
				break;
				
			case "has entered":
				command = "enteredBnet";
				param = msg;				
				break;
				
			case "joined the channel":
				command = false;
				
				if (inGame.length > 0) {
					command = "joinedChannel";			
				}
				break;
				
			default:
				break;
			}
			
			if (command) {
				cmd = {
					cmd: command, 
					param: param, 
					acc: nick[1], 
					nick: nick[0]
				};	
					
				thingsToDo.push(JSON.stringify(cmd));		
			}
		}
	};
	
	this.stupidMasterCmds = function(words) {
		var i, param, obj, split, spot,
			cmd = true;

		if (!words.match(me.charname.toLowerCase())) {
			return false;
		}
		
		for (i = 0; i < commands.length; i++) {
			if (words.match(adminTrig + commands[i].toLowerCase())) {

				split = words.split(" ");
				spot = split.indexOf(adminTrig + commands[i].toLowerCase());
				spot++;
				
				if (split[spot]) {				
					param = split[spot];
				}
				
				obj = {
					cmd : commands[i],
					param : param,
					nick : me.charname.toLowerCase(),
					acc : me.account.toLowerCase()
				};
				
				if (cmd) {
					thingsToDo.unshift(JSON.stringify(obj));
				}
				return true;
			}
		}
		return false;
	};	
	
	this.checkCommands = function (obj) {
		if (obj.nick === me.charname.toLowerCase()) {
			return true;
		}
		
		switch (obj.cmd) {
			case "login":
			case "logout":
			case "announce":
				if (!runners[obj.nick])  {
					
					if (runners[obj.acc]) { //added account instead of nick -_-...
						this.debug("ÿc8GM :: ÿc2ChatEvent: ÿc0Acc was added instead of nick.. fixing..");
						this.addNewRunner(obj.nick, obj.acc);
						delete runners[obj.acc];
						
						return true;
					}
					
					this.debug("ÿc8GM :: ÿc2ChatEvent: ÿc0User: " + obj.nick + " is not a runner");						
					return false;					
				}
				break;
			case "addRunner":
			case "removeRunner":
			case "addAdmin":
			case "removeAdmin":
			case "kick":
			case "ban":
			case "unban":
				if (adminList.indexOf(obj.acc) === -1)  {
					this.debug("ÿc8GM :: ÿc2ChatEvent: ÿc0User: " +obj.acc + " is not an admin");
					return false;
				}				
				break;	
			default:
			break;
		}
		
		return true;
	};
	
	this.checkLoggedIn = function () {
		var i, runner, autoLogout, update, lastUpdate;
		
		for (i = 0; i < loggedIn.length; i++) {
			runner = loggedIn[i];
			
			if (runners.hasOwnProperty(runner)) {								
				lastUpdate = getTickCount() - runners[runner].lastUpdate;
				autoLogout = getTickCount() - runners[runner].lastEvent;

				if (autoLogout > autoLogoutTime * 6e4) {
					this.debug("ÿc8GM :: ÿc2checkLoggedIn: ÿc0" + runner + " has been inactive too long. logging out.");					
					thingsToDo.push(JSON.stringify({cmd: "logout", param: "auto", nick: runner, acc: "none"}));	
					update = true;					
				}

				if (lastUpdate > updateInterval * 1e3) {			
					runners[runner].lastUpdate = getTickCount();
					
					this.debug("ÿc8GM :: ÿc2checkLoggedIn: ÿc0updating: " + runner);
					update = true;
				}
			}
		}
		if (update) {
			updateVariables = true;
		}
		
		return true;
	};

	// Returns game length. input is tick count
	this.getGameLength = function (tick) {
		if (!tick) {
			return "";
		}

		var min, msg, sec;

		min = Math.floor((getTickCount() - tick) / 60000).toString();
		
		if (min === 0) {
			min = false;
		} else {
			if (min <= 9) {
				min = "0" + min;
			}
		}

		sec = (Math.floor((getTickCount() - tick) / 1000) % 60).toString();

		if (sec <= 9) {
			sec = "0" + sec;
		}
		
		if (!min) {
			msg = sec + " Seconds ";
		} else {
			msg = min + " Minutes " + sec + " Seconds ";
		}

		return msg;
	};
	
	// clear friends list 
	this.clearFriends = function () {
		var words, text, i, array, maxText, maxI,	
		firstTime = true;
		
		while (true) {
			text = ControlAction.getText(4, 28, 410, 354, 298);

			if (firstTime) {
				i = text.length;
				say("/f l");
				delay(1200);

				maxText = ControlAction.getText(4, 28, 410, 354, 298);
				maxI = maxText.length - 1;
				firstTime = false;
			}
			
			if (text) {
				for (i; i < text.length; i++) {
					if (text[i]) {
						
						words = text[i].toLowerCase().replace(/\<|\>|\(|\)|\*|\,|ÿc[0-9!"+<;.*]/gi, "");
						array = words.split(" ");
						
						if (words.match(/don't have any/gi)) {
							this.debug("ÿc8GM :: ÿc2clearFriends: ÿc0No friends to remove. Done");
							return true;
						}
						
						if (array[0].match(/^\d+/gi)) {
							say("/f r " + array[1]);
							delay(1200);
						}

						if (i === maxI) {
							this.debug("ÿc8GM :: ÿc2clearFriends: ÿc0Done clearing friends.");
							return true;
						}
					}			
				}
			}
		}
		return true;
	};

	this.updateVars = function(funct) {
		var info;
		
		info = storedInfo.read();
			
		switch (funct) {
			case "localInfo": // Update local variables with JSON file
				runners = info.runners;
				adminList = info.adminList;
				topFive = info.topFive;
				banList = info.banList;
				
			break;
			default: // Update JSON file with local variables
				info.runners = runners;
				info.adminList = adminList;
				info.topFive = topFive;
				info.banList = banList;
				
				this.debug("ÿc8GM :: ÿc2updateVars: ÿc0backing up info..");
			break;		
		}
		
        storedInfo.write(info, me.profile);	
		
		return true;
	};
	
	this.updateTop = function (nick) {
		var newTopRunner, peeps, obj, topRunners, highest;
		
		if (!topFive[nick]) {
			if (topFive.length < 5 || topFive.length === undefined) {
				newTopRunner = true; 
			}
			
			if (topFive.length === 5) {
				for (topRunners in topFive) {
					if (topFive.hasOwnProperty(topRunners)) {
						if (topFive[topRunners].runs < runners[nick].runs) {
							highest = topRunners;
						}
					}
				}
				if (highest) {
					delete topFive[highest];			
					newTopRunner = true;
				}
			}	

			if (newTopRunner) {
				obj = {
					runs: runners[nick].runs,
					fastest: runners[nick].fastestRun
				};
				
				topFive[nick] = obj; 
				this.debug("ÿc8GM :: ÿc2updateRuns: ÿc0New top runner: " + JSON.stringify(topFive));
				updateVariables = true;
			}			
		}
		
		for (peeps in topFive) {
			if (topFive.hasOwnProperty(peeps)) {
				topFive[peeps].runs = runners[peeps].runs;
				topFive[peeps].fastest = runners[peeps].fastestRun;
			}
		}
		return true;
	};
	
	this.updateRuns = function (nick) {
		var runLength;

		runLength = getTickCount() - runners[nick].timeEnteredTick;

		if (runLength > minGameTime * 1e3) {
			runners[nick].runs++;

			if (runLength < runners[nick].fastestRunTick) {

				runners[nick].fastestRunTick = runLength;
				runners[nick].fastestRun = this.getGameLength(runners[nick].timeEnteredTick);
				
				this.debug("ÿc8GM :: ÿc2updateRuns: ÿc0New runtime record: " + runners[nick].fastestRun);
			}
			return true;
		}			
		return false;
	};
	
	this.addNewRunner = function(nick, acc) {
		var obj;
		
		obj = {
			account: acc,
			runs: 0,
			fastestRun: "NONE",
			fastestRunTick: 999999999999,
			gameType: "",
			gameName: "",
			timeEnteredTick: 0,
			lastUpdate: 0,
			lastEvent: 0,
			announce: true
		};
		
		runners[nick] = obj;
		
		return true;
	};
	
	this.beautify = function (obj) {
		var info;
		
		info = JSON.stringify(obj);	
		info = info.replace(/\{|\}|\"|\'/gi, "");
		info = info.replace(/\:/gi, ": ");
		info = info.replace(/\,/gi, " // ");
		
		return info;
	};
	
	this.announce = function (obj) {
		var status;
		
		if (obj.param === undefined) {
			obj.param = false;
		}
		
		switch (obj.param) {
			case false:
				if (!runners[obj.nick].announce) {
					status = "off";
				} else {
					status = "on";
				}
				
				msg("Announcing of games is currently: " + status + ". To turn on or off, type on or off after the command.", obj.nick);		
				break;
				
			case "on":
				runners[obj.nick].announce = true;
				msg("Announcing of games is now ON.", obj.nick);		
				updateVariables = true;
				break;			
				
			case "off":
				runners[obj.nick].announce = false;
				msg("Announcing of games is now OFF.", obj.nick);	
				updateVariables = true;
				break;
				
			default:
				break;
		}
		
		return true;
	};
	
	this.games = function(obj) {
		var i, message, array = [];
		
		if (inGame.length === 0) {
			say("There are currently no active games");
			return true;
		}

		for (i = 0; i < inGame.length; i++) {
			if (runners[inGame[i]].gameType !== undefined) {
				
				if (!obj.param) {
					array.push(runners[inGame[i]].gameType);
					
				} 
				else {					
					if (obj.param === runners[inGame[i]].gameType) {
						array.push(inGame[i] + ":  " + runners[inGame[i]].gameName + ", ");
					}					
				}
			}
		}
		
		message = this.beautify(array);
		
		if (obj.param) {
			if (array.length === 0) {
				msg("The game type " + obj.param.toUpperCase() + " is not valid.", obj.nick);	
				return true;
			}
			
			msg("Current " + obj.param.toUpperCase() + " games are:  " + message, obj.nick);
			return true;
		}
		
		msg("There are currently " + inGame.length + " games going on right now. Current game types are: " + message, obj.nick);		
		return true;
	};

	this.stats = function(obj) {
		var stats,
			user = obj.nick;
					
		if (obj.param) {
			user = obj.param;
		}

		if (runners[user]) {
			stats = runners[user];

		} else {
			msg("That runner does not exist!");
			return true;
		}

		msg("Current stats for " + user + ": Fastest run time of (" + stats.fastestRun + ") and " + stats.runs + " total runs. ", obj.nick);
		
		return true;
	};

		
	this.top = function (obj) {
		var info;
		
		info = this.beautify(topFive);
		
		msg(info, obj.nick);
		
		return true;
	};
	
	this.help = function (obj) {
		var i, param = "none", 
			array = [];
		
		for (i = 0; i < commands.length;i++) {
			array.push(adminTrig + commands[i]);
		}
		
		if (runners[obj.nick] !== undefined)  {	
			param = "runner";
		}
		
		if (adminList.indexOf(obj.acc) > -1)  {
			param = "admin";
		}		

		switch (param) {
			case "admin":
				array = array.slice(7, array.length);
			break;
			case "runner":
				array = array.slice(0, 6);					
			break;
			default:
				msg(false, obj.nick, "help");
				return true;
			break;
		}				
		
		array = array.toString();
		array = array.replace(/\,/gi, ", ");
		msg("Current commands are:  " + array, obj.nick);
	
		return true;
	};

	this.joinedGame = function(obj) {
		var cmd, game, x,
			array = obj.param.split(" ");
			
		if (inGame.indexOf(obj.nick) > -1) {
			if (this.updateRuns(obj.nick)) {
				this.updateTop(obj.nick);
			}
		} else {
			inGame.push(obj.nick);	
		}
		
		cmd = array.indexOf("called");
		cmd++;
		
		array = array.slice(cmd, array.length);

		game = array.toString().toLowerCase().replace(/\,/gi, " ");
		game = game.replace(/\./gi, "");
		
		for (x = 0; x < gameTypes.length; x++) {
			if (game.match(gameTypes[x].toLowerCase())) {
				runners[obj.nick].gameType = gameTypes[x].toLowerCase();
			}
		}
		
		runners[obj.nick].gameName = game;
		runners[obj.nick].timeEnteredTick = getTickCount();	
		
		if (announceGames && runners[obj.nick].announce) {
			msg("/me :: " + obj.nick + " is in game: " + game);

			return true;
		}			
				
		return false;
	};				
				
	this.joinedChannel = function(obj) {
		var runLength, place, longEnough;

		if (loggedIn.indexOf(obj.nick) === -1 || inGame.indexOf(obj.nick) === -1) {
			return false;
		}
		
		if (this.updateRuns(obj.nick)) {
			this.updateTop(obj.nick);
			longEnough = true;
		}		
		
		runLength = this.getGameLength(runners[obj.nick].timeEnteredTick);
		runners[obj.nick].lastEvent = getTickCount();
		place = inGame.indexOf(obj.nick);											
		inGame.splice(place, 1);
		
		if (announceGames) {			
			if (longEnough) {
				msg(obj.nick + ", Your last run was: " + runLength, obj.nick);
			} else {
				msg(obj.nick + ", Your last run was not long enough.", obj.nick);	
			}
		}	
		return true;
	};
	
	this.enteredBnet = function (obj) {
		//Do Something
		return false;
	};
	
	this.leftBnet = function (obj) {
		if (logoutOnExit) {
			thingsToDo.push(JSON.stringify({
				cmd: "logout", 
				param: "leftBnet", 
				nick: obj.nick, 
				acc: "none"
			}));
		}
		
		return true;
	};
	
	this.login = function(obj) {
		if (loggedIn.indexOf(obj.nick) > -1) {
			msg("You are already logged in.", obj.nick);
			return true;
		}		
		
		if (runners[obj.nick].account === false) {
			runners[obj.nick].account = obj.acc;
			updateVariables = true;
		}
		
		loggedIn.push(obj.nick);
		runners[obj.nick].lastUpdate = getTickCount();
		runners[obj.nick].lastEvent = getTickCount();
		
		msg("/f a " + obj.acc); 
		
		if (obj.param) {
			return true;
		}
		
		msg("You are logged in now. Be sure to add me as a friend!", obj.nick);
		
		return true;
	};

	this.logout = function(obj) {
		var place, 
			acc = runners[obj.nick].account;
		
		if (loggedIn.indexOf(obj.nick) === -1) {
			msg("You are not logged in right now.", obj.nick);
			return true;
		}
		
		
		if (!obj.param) {
			obj.param = "none";
		}
		
		switch (obj.param) {
			case "auto":
				msg("You have been logged out for inactivity.", obj.nick);
				break;
			case "leftBnet":
				break;
			default:
				msg("You are logged out.", obj.nick);
				break;			
		}	
		
		place = loggedIn.indexOf(obj.nick);
		loggedIn.splice(place, 1);

		msg("/f r " + acc);		
		updateVariables = true;
		
		return true;
	};

	this.addAdmin = function(obj) {			
		if (adminList.indexOf(obj.param) > -1) {
			msg("That member is already an admin.", obj.nick);
			return true;
		}

		adminList.push(obj.param);
		msg("Adding new admin: " + obj.param, obj.nick);
		updateVariables = true;
		
		return true;
	};

	this.removeAdmin = function(obj) {		
		var place;
		
		if (adminList.indexOf(obj.param) === -1) {
			msg("That member is not an admin", obj.nick);
			return true;
		}
		
		msg("Removed admin: " + obj.param, obj.nick);
		place = adminList.indexOf(obj.param);
		adminList.splice(place, 1);
		updateVariables = true;
		
		return true;
	};

	this.addRunner = function(obj) {			
		if (!obj.param) {
			msg("Please specify a user", obj.nick);
			this.debug("ÿc8GM :: ÿc2addRunner: ÿc0no user specified");
			return true;
		}

		if (runners[obj.param]) {
			msg("That runner already exists.", obj.nick);
			this.debug("ÿc8GM :: ÿc2addRunner: ÿc0User already exists");
		} else {
			msg("Added runner: " + obj.param, obj.nick);
			this.debug("ÿc8GM :: ÿc2addRunner: ÿc0Added user");

			this.addNewRunner(obj.param, false);
			updateVariables = true;
		}
		
		return true;
	};

	this.removeRunner = function(obj) {		
		var place, account;
		
		if (!obj.param) {
			msg("Please specify a user", obj.nick);
			return true;
		}

		if (!runners[obj.param]) {
			msg("That runner doesn't exist.", obj.nick);
		} else {
			msg("Removed runner: " + obj.param, obj.nick);
			
			if (loggedIn.indexOf(obj.param) > -1) {
				
				place = loggedIn.indexOf(obj.param);
				account = runners[obj.param].account;
				loggedIn.splice(place, 1);			
				
				msg("/f r " + account);
			}
			
			delete runners[obj.param];

			updateVariables = true;
		}	
		
		return true;
	};

	this.ban = function(obj) {
		if (obj.param === me.charname.toLowerCase()) {
			return false;
		}
		if (banList.indexOf(obj.param) > -1) {			
			msg(obj.param + " is already banned.", obj.nick);
			return true;
		}			
			
		msg("/ban " + obj.param);			
		banList.push(obj.param);
		msg(obj.param + " Is now banned", obj.nick);
		updateVariables = true;

		return true;
	};

	this.unban = function(obj) {
		var place;
		
		if (banList.indexOf(obj.param) === -1) {
			msg(obj.param + " was not banned.", obj.nick); 
			return true;
		}
		place = banList.indexOf(obj.param);
		
		msg(obj.param + " Is now unbanned", obj.nick);
		msg("/unban " + obj.param);
		banList.splice(place, 1);
		updateVariables = true;
		
		return true;
	};

	this.kick = function(obj) {			
		msg("/kick " + obj.param);
		
		return true;
	};
	
	this.listRunners = function(obj) {		
		var list, names, array = [];
		
		if (runners.length === 0) {
			msg("There are currently no admins", obj.nick);
			return true;
		}
		for (names in runners) {
			if (runners.hasOwnProperty(names)) {
				array.push(names);
			}
		}
		
		list = array.toString();

		msg("Current runners are: " + list, obj.nick);
		
		return true;
	};
	
	this.listAdmins = function(obj) {		
		var list;
		
		if (adminList.length === 0) {
			msg("There are currently no admins", obj.nick);
			return true;
		}
		list = adminList.toString();

		msg("Current admins are: " + list, obj.nick);
		
		return true;
	};
	
	//**************** Function Starts here *************//
	
	include("OOG.js");
	include("json2.js");
	include("common/Misc.js");
	print("ÿc2Start Game Manager Script");
	D2Bot.init();
	
	// Create our profile to store info
	if (!FileTools.exists('Profiles/' + "GM_" + me.profile + ".json")) {
		storedInfo.create();
	}
	
	// Update all variables locally with JSON file
	this.updateVars("localInfo");

	addEventListener("chatmsg", this.ChatEvent);
	addEventListener("whispermsg", this.ChatEvent);
	
	if (clearFriendsList) {
		this.clearFriends();
	}

	// Start main loop here!!!
	while (true) {
		while (getLocation() !== 3) {
			delay(100);
		}

		if (loggedIn.length !== 0) {
			this.checkLoggedIn();
		}
		
		if (updateVariables) {
			this.updateVars();
			updateVariables = false;
		}
		
		textOnScreen = ControlAction.getText(4, 28, 410, 354, 298);

		if (textOnScreen) {
			for (index; index < textOnScreen.length; index++) {
				words = textOnScreen[index].toLowerCase().replace(/\<|\>|\(|\)|\*|\,|ÿc[0-9!"+<;.*]/gi, "");

				this.stupidMasterCmds(words);
			}
		}
		
		if (getTickCount() - lastAction > delayBetweenCmds * 1e3) {
			if(thingsToDo[0]) {
				info = JSON.parse(thingsToDo[0]);		

				try {
					this.debug("ÿc8GM :: ÿc2Trying command: ÿc0" + info.cmd);
					
					if (this.checkCommands(info)) {
						this[info.cmd](info);
						lastAction = getTickCount();
					}
					
					thingsToDo.shift(); 
				} catch (e) {
					info = JSON.stringify(thingsToDo[0]);
					print ("error " + info);
					
					while (true) {
						delay (50);
					}
				} 
			}
		}
		delay(200);
	}

	return true;
}