const fs = require('fs'),
  path = require("path"),
  fetch = require('node-fetch'), //Webcall
  setup = require(path.resolve(__dirname, '../../hidden/setup')),
  io = require("socket.io"),
  Overlays = io.listen(7566);


//##### GAME SET UP
const settings = JSON.parse(fs.readFileSync(path.resolve(__dirname, './GWsettings.json'))),
  gameSetup = JSON.parse(fs.readFileSync(path.resolve(__dirname, './hidden/GWsetup.json'))),
  GameUserDatabase = path.resolve(__dirname, './hidden/GWusers.json'),
  GameEventDatabase = path.resolve(__dirname, './hidden/GWevents.json');
//!!!!!!!!!!!!!!!! DEVMODE DISABLES CHAT LOGGER
let devMode = false;
//!!!!!!!!!!!!!!!! DEVMODE

let gameName = settings.gameName

if (devMode) {
  console.log('########## DEV MODE ENABLED ##########');
} else {
  setTimeout(() => {
    console.log(`*** ${gameName} module loaded: Use command ${settings.chatCommand} start in Twitch chat to Start or Refresh the game. Use ${settings.chatCommand} stop to pause the game.`);
  }, 2500);
};

let gameUsers = [], //populate on game start: loadGSheetData()
  gameEvents = [], //populate on game start: loadGSheetData()
  teamCooldowns = {
    standard: {
      red: false,
      blue: false,
      green: false,
      orange: false,
      purple: false,
    },
    special: {
      red: false,
      blue: false,
      green: false,
      orange: false,
      purple: false,
    },
  },
  numberLimit = 200;
firstLoad = true;

Overlays.on('connection', socket => {
  socket.on('overlayLoaded', overlay => {
    console.log(`*** ${gameName} Overlay Loaded: ${overlay}`);
  });
  refreshOverlays();
})

module.exports = {
  settings: settings,
  main: async (client, room, user, msg, isEditor) => {
    let msgA = msg.toLowerCase().split(' '),
      res = {
        "log": false, //log message
        "enabled": false, //should bot respond to this action
        "type": 'say', //"say", "action" or "whisper" ... shoudld bot say to chat, use /me message chat, or whisper response
        "msg": `` //same as current res string
      };
    msgA.shift(); //remove command from message

    if (isEditor) {
      if (msgA[0] === 'enable' || msgA[0] === 'start' || msgA[0] === 'refresh') {
        settings.enabled = true;
        res = await loadGSheetData();
        refreshOverlays();
      } else if (msgA[0] === 'disable' || msgA[0] === 'stop' || msgA[0] === 'pause') {
        settings.enabled = false;
        res = {
          "log": true,
          "enabled": true,
          "type": 'action',
          "msg": `${gameName} has been disabled/paused`
        };
      } else if (msgA[0] === 'togglespecial') {
        res = toggleSpecial(msgA[1]);
      } else if (msgA[0] === 'pop' || msgA[0] === 'population') {
        res = setGamePopulation(msgA[1]);
      } else if (msgA[0] === 'newgame' || msgA[0] === 'reload') {
        console.log("New Game Started")
        settings.enabled = true;
        firstLoad = true;
        numberLimit = 200;
        teamCooldowns = {
          standard: {
            red: false,
            blue: false,
            green: false,
            orange: false,
            purple: false,
          },
          special: {
            red: false,
            blue: false,
            green: false,
            orange: false,
            purple: false,
          },
        };
        refreshOverlays();
        res = await loadGSheetData();
      };
      if (res.msg !== '') {
        return BotResponse(client, room, res, user, msg);
      };
    };
    if (!settings.enabled) return 'not enabled';
    let userIndex = gameUsers.findIndex(i => i.userName === user.username);
    if (userIndex < 0) {
      res = {
        "log": false,
        "enabled": true,
        "type": 'whisper',
        "msg": `${user['display-name']} is not registered in ${gameName}. Visit the Discord to join!`
      };
      return BotResponse(client, room, res, user, msg);
    }
    let eventIndex = gameEvents.findIndex(i => i.name === msgA[0]),
      gameUser = gameUsers[userIndex],
      gameEvent = gameEvents[eventIndex];
    if (eventIndex < 0) { //check if a valid event
      res = {
        "log": false,
        "enabled": true,
        "type": 'whisper',
        "msg": `${msgA[0]} is not a valid event!`
      };
    } else if (gameEvent.args && !msgA[1]) { //check if extra arg required
      res = {
        "log": false,
        "enabled": true,
        "type": 'whisper',
        "msg": `${msgA[0]} requires a target!`
      };
    } else if (gameEvent.numLimit >= numberLimit) {
      res = {
        "log": false,
        "enabled": true,
        "type": 'whisper',
        "msg": `${msgA[0]} requires more than ${gameEvent.numLimit} in total prison population!`
      };
    } else {
      if (gameEvent.type === 'standard') {
        res = await GameStandardEvent(msgA, user['display-name'], gameUser, gameEvent);
      } else if (gameEvent.type === 'special') {
        res = await GameSpecialEvent(msgA, user['display-name'], gameUser, gameEvent);
      } else {
        res = await GameSecretEvent(msgA, user['display-name'], gameUser, gameEvent);
      };
    };
    return BotResponse(client, room, res, user, msg);
  }
}; //END EXPORTS OBJECT

const BotResponse = (client, room, res, user, msg) => {
  if (res.log || devMode) {
    if (devMode) {
      console.log(`[${new Date().toTimeString().substr(0, 8)}] ${user['display-name']}: ${msg}`); //Dev mode
    } else if (settings.logToChannel) {
      client.say(settings.logChannel, `${user['display-name']}: ${msg}`).catch((err) => {
        console.log(err)
      });
    };
  };
  if (!res.enabled || devMode) return res;
  if (res.type === 'whisper') {
    client.whisper(user.username, res.msg).catch((err) => {
      console.log(err)
    });
  } else if (res.type === 'action') {
    client.action(room, res.msg).catch((err) => {
      console.log(err)
    });
  } else {
    client.say(room, res.msg).catch((err) => {
      console.log(err)
    });
  };
  return res;
};

const GameStandardEvent = async (msgA, username, gameUser, gameEvent) => {
  let res;
  if (teamCooldowns.standard[gameUser.team]) {
    res = {
      "log": false,
      "enabled": true,
      "type": 'say',
      "msg": `${getTeamEmote(gameUser.team)} is on cooldown for Standard Events`
    };
  } else if (new Date() - gameUser.lastStandard < settings.cooldownStandardUser * 1000) {
    let userCooldownMilliseconds = Math.ceil(((settings.cooldownStandardUser * 1000) - (new Date() - gameUser.lastStandard))),
      userCooldownTimeString = new Date(userCooldownMilliseconds).toTimeString(),
      userCooldownMinutes = parseInt(userCooldownTimeString.substr(3, 2)),
      userCoolDownSeconds = parseInt(userCooldownTimeString.substr(6, 2));
    res = {
      "log": false,
      "enabled": true,
      "type": 'whisper',
      "msg": `${username} is on personal cooldown for: ${userCooldownMinutes > 0 ? userCooldownMinutes + 'min ' : ''}${userCoolDownSeconds}sec.`
    };
  } else {
    let userData = await getFromSE(username),
      points = userData.points || -1;
    if (!userData) {
      res = {
        "log": false,
        "enabled": false,
        "type": 'action',
        "msg": `I couldn't find someone on Stream Elements Leaderboard!`
      };
      console.log(`Error: I couldn't find someone on Stream Elements Leaderboard! : ${username} not found`)
    } else if (points < settings.pointCostStandard) {
      res = {
        "log": false,
        "enabled": true,
        "type": 'whisper',
        "msg": `${username} does not have enough pieces. You have: ${points}`
      };
    } else {
      teamCooldowns.standard[gameUser.team] = setTimeout(() => {
        teamCooldowns.standard[gameUser.team] = false;
      }, gameEvent.cooldown * 1000);
      Overlays.emit('eventClaimed', {
        type: 'Standard',
        team: gameUser.team,
        length: (gameEvent.cooldown + settings.coolddownOverlayDelay),
        user: username,
        event: gameEvent.name
      });
      gameUser.lastStandard = new Date();
      res = {
        "log": true,
        "enabled": true,
        "type": 'say',
        "msg": `${username} ${getTeamEmote(gameUser.team)} claimed event: ${msgA[0].toUpperCase()}`
      };
      putToSE(username, settings.pointCostStandard * -1); //remove points from user
    };
  };
  return res;
};

const GameSpecialEvent = async (msgA, username, gameUser, gameEvent) => {
  let res;
  if (teamCooldowns.special[gameUser.team]) {
    res = {
      "log": false,
      "enabled": true,
      "type": 'say',
      "msg": `${getTeamEmote(gameUser.team)} is on cooldown for Special Events`
    };
  } else if (gameUser.usedSpecial) {
    res = {
      "log": false,
      "enabled": true,
      "type": 'whisper',
      "msg": `${username} has already claimed Special Event for this stream`
    };
  } else {
    let userData = await getFromSE(username),
      points = userData.points || -1;
    if (!userData) {
      res = {
        "log": false,
        "enabled": false,
        "type": 'action',
        "msg": `I couldn't find someone on Stream Elements Leaderboard!`
      };
      console.log(`Error: I couldn't find someone on Stream Elements Leaderboard! : ${username} not found`)
    } else if (points < settings.pointCostSpecial) {
      res = {
        "log": false,
        "enabled": true,
        "type": 'whisper',
        "msg": `${username} does not have enough pieces. You have: ${points}`
      };
    } else {
      Overlays.emit('eventClaimed', {
        type: 'Special',
        team: gameUser.team,
        length: (gameEvent.cooldown + settings.coolddownOverlayDelay),
        user: username,
        event: gameEvent.name
      });
      if (gameEvent.name === 'reset') {
        Object.entries(teamCooldowns).forEach(([key, value]) => {
          Object.entries(value).forEach(([team, teamTimer]) => {
            teamCooldowns[key][team] = setTimeout(() => {
              teamCooldowns[key][team] = false;
            }, gameEvent.cooldown * 1000);
          });
        });
        refreshOverlays(gameEvent.cooldown);
      } else {
        teamCooldowns.special[gameUser.team] = setTimeout(() => {
          teamCooldowns.special[gameUser.team] = false;
        }, gameEvent.cooldown * 1000);
      };
      gameUser.usedSpecial = true;
      res = {
        "log": true,
        "enabled": true,
        "type": 'say',
        "msg": `${username} ${getTeamEmote(gameUser.team)} claimed their special: ${msgA[0].toUpperCase()}`
      };
      putToSE(username, settings.pointCostSpecial * -1); // -1 remove points from user
    };
  };
  return res;
};

const GameSecretEvent = (msgA, username, gameUser, gameEvent) => {
  let res;
  if (gameUser.secretsRemaining > 0) {
    Overlays.emit('eventClaimed', {
      type: 'Secret',
      team: gameUser.team,
      user: username,
      event: gameEvent.name
    });
    gameUser.secretsRemaining -= 1;
    res = {
      "log": true,
      "enabled": true,
      "type": 'say',
      "msg": `${username} ${getTeamEmote(gameUser.team)} CLAIMED: SECRET!`
    };
  } else if (gameUser.secretsRemaining === 0) {
    res = {
      "log": false,
      "enabled": true,
      "type": 'action',
      "msg": `${username} has already claimed the secret!`
    };
  } else {
    res = {
      "log": false,
      "enabled": true,
      "type": 'whisper',
      "msg": `${username} is not a teamleader`
    };
  };
  return res;
};

const getTeamEmote = (team) => {
  return team === 'red' ? settings.emoteRed : team === 'blue' ? settings.emoteBlue : settings.emoteGreen
}

const getFromSE = (user) => {
  return fetch(`https://api.streamelements.com/kappa/v2/points/${setup.SE_ACCOUNTID}/${user}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${setup.SE_JWTTOKEN}`
      },
    })
    .then(response => {
      if (!response.ok) {
        throw new Error();
      }
      return response.json();
    })
    .then(json => {
      return (json);
    })
    .catch(error => {
      return false;
    });
};

const putToSE = async (user, points) => {
  fetch(`https://api.streamelements.com/kappa/v2/points/${setup.SE_ACCOUNTID}/${user}/${points}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${setup.SE_JWTTOKEN}`
      },
    })
    .then(response => {
      if (!response.ok) {
        throw new Error();
      }
    })
    .catch(error => console.error(`Error Removing Points for ${gameName}`))
  return;
};

async function loadGSheetData() {
  let spreadID = gameSetup.gSheetId,
    sheetID = "1",
    targetCells = "A:H",
    APIKEY = gameSetup.gAPI,
    dataSource = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadID + "/values/Sheet" + (sheetID) + "!" + targetCells + "?key=" + APIKEY,
    tempUsers = [...gameUsers];

  const userDatabase = await fetch(dataSource)
    .then(response => response.json())
    .then(json => {
      if (json.error) {
        if (firstLoad) {
          gameUsers = JSON.parse(fs.readFileSync(GameUserDatabase));
        };
        return false;
      };

      gameUsers = [];
      json.values.forEach(user => {
        let userName = user[0].toLowerCase().trim();
        if (!firstLoad) { //check if mid game reload and save current progress
          let userIndex = tempUsers.findIndex(i => i.userName === userName);
          if (userIndex >= 0) {
            gameUsers.push(tempUsers[userIndex]);
            return;
          };
        };
        newUser = {};
        newUser.userName = userName
        newUser.team = user[1].toLowerCase();
        newUser.lastStandard = ''
        newUser.usedSpecial = false;
        if (user[2] !== undefined) {
          newUser.secretsRemaining = parseInt(user[2]) || 1;
        }
        gameUsers.push(newUser);
      });
      fs.writeFileSync(GameUserDatabase, JSON.stringify(gameUsers, null, 4), "utf8");
      console.log(`${gameName} user database has loaded!`)
      return true;
    })
    .catch(error => {
      console.error("Error Getting Username Data from Google: ", error);
      return false;
    });

  sheetID = "2"; // gid+1
  dataSource = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadID + "/values/Sheet" + (sheetID) + "!" + targetCells + "?key=" + APIKEY;

  const eventDatabase = await fetch(dataSource)
    .then(response => response.json())
    .then(json => {
      if (json.error) {
        if (firstLoad) {
          gameEvents = JSON.parse(fs.readFileSync(GameEventDatabase));
        };
        return false;
      };

      gameEvents = [];
      json.values.shift()
      json.values.forEach(event => {
        newEvent = {};
        newEvent.name = event[0];
        newEvent.type = event[1];
        newEvent.args = event[2] == "TRUE";
        newEvent.cooldown = parseInt(event[3]);
        event[4] ? newEvent.numLimit = parseInt(event[4]) : null;
        newEvent.desc = event[5];
        gameEvents.push(newEvent);
      });
      fs.writeFileSync(GameEventDatabase, JSON.stringify(gameEvents, null, 4), "utf8");
      console.log(`${gameName} event database has loaded!`)
      return true;
    })
    .catch(error => {
      console.error("Error Getting Event Data from Google: ", error);
      return false;
    });

  firstLoad = false;
  return userDatabase && eventDatabase ? {
    "log": true,
    "enabled": true,
    "type": 'action',
    "msg": `${gameName} Module has been loaded!`
  } : {
    "log": true,
    "enabled": true,
    "type": 'action',
    "msg": `Error in ${gameName} database. Try again!`
  };
};

const toggleSpecial = (target) => {
  target = target.replace('@', '');
  let userIndex = gameUsers.findIndex(i => i.userName === target);
  if (userIndex < 0) {
    res = {
      "log": false,
      "enabled": true,
      "type": 'whisper',
      "msg": `${target} is not in ${gameName} database. Cannot update setting.`
    };
  } else {
    let gameUser = gameUsers[userIndex];
    gameUser.usedSpecial = gameUser.usedSpecial ? false : true;
    res = {
      "log": true,
      "enabled": true,
      "type": 'whisper',
      "msg": `${target}'s "Special Used" has been set to ${gameUser.usedSpecial}`
    };
  };
  return res;
};

const setGamePopulation = (num) => {
  let res;

  num = parseInt(num);
  if (num) {
    res = {
      "log": true,
      "enabled": true,
      "type": 'action',
      "msg": `${gameName} population has been set to ${num}`
    };
    numberLimit = num;
  } else {
    res = {
      "log": false,
      "enabled": true,
      "type": 'whisper',
      "msg": `${settings.chatCommand} population <number> Make sure 2nd argument is a number!`
    };
  };
  return res;
};

const refreshOverlays = (time) => {
  Overlays.emit('loadTimerData', {
    redStandard: time || Math.ceil((teamCooldowns.standard.red._idleStart + teamCooldowns.standard.red._idleTimeout) / 1000 - process.uptime()),
    redSpecial: time || Math.ceil((teamCooldowns.special.red._idleStart + teamCooldowns.special.red._idleTimeout) / 1000 - process.uptime()),
    greenStandard: time || Math.ceil((teamCooldowns.standard.green._idleStart + teamCooldowns.standard.green._idleTimeout) / 1000 - process.uptime()),
    greenSpecial: time || Math.ceil((teamCooldowns.special.green._idleStart + teamCooldowns.special.green._idleTimeout) / 1000 - process.uptime()),
    blueStandard: time || Math.ceil((teamCooldowns.standard.blue._idleStart + teamCooldowns.standard.blue._idleTimeout) / 1000 - process.uptime()),
    blueSpecial: time || Math.ceil((teamCooldowns.special.blue._idleStart + teamCooldowns.special.blue._idleTimeout) / 1000 - process.uptime()),
  })
}
