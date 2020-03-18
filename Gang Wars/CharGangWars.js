const fs = require('fs'),
  fetch = require('node-fetch'), //Webcall
  setup = require('../hidden/setup'),
  settings = JSON.parse(fs.readFileSync('./Gang Wars/GWsettings.json')),
  gwSetup = JSON.parse(fs.readFileSync('./Gang Wars/hidden/GWsetup.json')),
  io = require("socket.io"),
  Overlays = io.listen(7566);

let gwUsers = [],
  gwEvents = [],
  commandCost,
  cooldownStandard = {
    "red": false,
    "green": false,
    "blue": false
  },
  cooldownSpecial = {
    "red": false,
    "green": false,
    "blue": false
  },
  firstLoad = true;

Overlays.on('connection', (socket) => {
  console.log('Overlay connected')
})

module.exports = {
  settings: settings,
  main: async (client, room, user, msg, isEditor) => {
    let msgA = msg.toLowerCase().split(' '),
      res = {
        "enabled": false, //should bot respond to this action
        "type": 'say', //"say", "action" or "whisper" ... shoudld bot say to chat, use /me message chat, or whisper response
        "msg": `` //same as current res string
      };
    msgA.shift() //remove command from message

    if (isEditor) {
      if (msgA[0] === 'enable' || msgA[0] === 'start' || msgA[0] === 'reload') {
        settings.enabled = true;
        res = await loadGSheetData();
      } else if (msgA[0] === 'disable' || msgA[0] === 'stop') {
        settings.enabled = false;
        res = {
          "enabled": true,
          "type": 'action',
          "msg": 'Gang Wars has been disabled'
        };
      };
      if (res.msg !== '') {
        Overlays.emit('enabledCommand', settings.enabled);
        BotResponse(client, room, res, user.username);
        return;
      };
    };
    if (!settings.enabled) return;
    let userIndex = gwUsers.findIndex(i => i.userName === user.username);
    if (userIndex < 0) {
      res = {
        "enabled": true,
        "type": 'whisper',
        "msg": `${user['display-name']} is not registered in Gang Wars. Visit the Discord to join a gang!`
      };
      BotResponse(client, room, res, user.username);
      return;
    }
    let eventIndex = gwEvents.findIndex(i => i.name === msgA[0]),
      gwUser = gwUsers[userIndex],
      gwEvent = gwEvents[eventIndex];

    if (eventIndex < 0) { //check if a valid event
      res = {
        "enabled": true,
        "type": 'whisper',
        "msg": `${msgA[0]} is not a valid event!`
      };
    } else if (gwEvent.args && !msgA[1]) { //check if extra arg required
      res = {
        "enabled": true,
        "type": 'whisper',
        "msg": `${msgA[0]} requires a target!`
      };
    } else {
      if (gwEvent.type === 'standard') {
        res = await CharGangWarsStandard(msgA, user['display-name'], gwUser, gwEvent);
      } else if (gwEvent.type === 'special') {
        res = await CharGangWarsSpecial(msgA, user['display-name'], gwUser, gwEvent);
      } else {
        res = await CharGangWarsSecret(msgA, user['display-name'], gwUser, gwEvent);
      }
    };
    BotResponse(client, room, res, user.username);
    return;
  }
};

const BotResponse = (client, room, res, username) => {
  if (!res.enabled) return;

  if (res.type === 'whisper') {
    client.whisper(username, res.msg);
  } else if (res.type === 'action') {
    client.action(room, res.msg);
  } else {
    client.say(room, res.msg);
  }
  return;
}

const CharGangWarsStandard = async (msgA, username, gwUser, gwEvent) => {
  let res;
  if (cooldownStandard[gwUser.gang]) {
    res = {
      "enabled": true,
      "type": 'say',
      "msg": `${getGangEmote(gwUser.gang)} is on cooldown for Standard Events`
    };
  } else if (new Date() - gwUser.lastStandard < settings.cooldownStandardUser * 1000) {
    res = {
      "enabled": true,
      "type": 'whisper',
      "msg": `${username} is on personal cooldown for Standard Events`
    };
  } else {
    let userData = await getFromSE(username);
    let points = userData.points || -1;
    if (points < 0) {
      res = {
        "enabled": true,
        "type": 'whisper',
        "msg": `${username} not found on Stream Elements leaderboard. You need to earn pieces!`
      };
    } else if (points < settings.pointCostStandard) {
      res = {
        "enabled": true,
        "type": 'whisper',
        "msg": `${username} does not have enough pieces. You have: ${points}`
      };
    } else {
      cooldownStandard[gwUser.gang] = setTimeout(() => {
        console.log(`EVENT COOLDOWN OVER FOR ${gwUser.gang.toUpperCase()} GANG`)
        cooldownStandard[gwUser.gang] = false;
      }, gwEvent.cooldown * 1000);
      Overlays.emit('eventClaimed', {
        type: 'Event',
        gang: gwUser.gang,
        length: (gwEvent.cooldown + settings.coolddownOverlayDelay),
        user: username,
        event: gwEvent.name
      });
      gwUser.lastStandard = new Date();
      res = {
        "enabled": true,
        "type": 'action',
        "msg": `${username} ${getGangEmote(gwUser.gang)} claimed event: ${msgA[0].toUpperCase()}`
      };
      putToSE(username, settings.pointCostStandard * -1); //remove points from user
    };
  };
  return res;
};

const CharGangWarsSpecial = async (msgA, username, gwUser, gwEvent) => {
  let res;

  if (cooldownSpecial[gwUser.gang]) {
    res = {
      "enabled": true,
      "type": 'say',
      "msg": `${getGangEmote(gwUser.gang)} is on cooldown for Special Events`
    };
  } else if (gwUser.usedSpecial) {
    res = {
      "enabled": true,
      "type": 'say',
      "msg": `${username} has already claimed Special Event for this stream`
    };
  } else {
    let userData = await getFromSE(username); //get user data from Stream Elements
    let points = userData.points || -1; //Get points or -1 if not found
    if (points < 0) {
      res = {
        "enabled": true,
        "type": 'whisper',
        "msg": `${username} not found on Stream Elements leaderboard. You need to earn pieces!`
      };
    } else if (points < settings.pointCostSpecial) {
      res = {
        "enabled": true,
        "type": 'whisper',
        "msg": `${username} does not have enough pieces. You have: ${points}`
      };
    } else {
      cooldownSpecial[gwUser.gang] = setTimeout(() => {
        console.log(`SPECIAL COOLDOWN OVER FOR ${gwUser.gang.toUpperCase()} GANG`)
        cooldownSpecial[gwUser.gang] = false;
      }, gwEvent.cooldown * 1000);
      Overlays.emit('eventClaimed', {
        type: 'Special',
        gang: gwUser.gang,
        length: (gwEvent.cooldown + settings.coolddownOverlayDelay),
        user: username,
        event: gwEvent.name
      });
      gwUser.usedSpecial = true;
      res = {
        "enabled": true,
        "type": 'action',
        "msg": `${username} ${getGangEmote(gwUser.gang)} claimed their special: ${msgA[0].toUpperCase()}`
      };
      putToSE(username, settings.pointCostSpecial * -1); //remove points from user
    }
  }
  return res;
};

const CharGangWarsSecret = async (msgA, username, gwUser, gwEvent) => {
  let res;
  if (typeof gwUser.usedSecret !== 'boolean') {
    res = {
      "enabled": true,
      "type": 'whisper',
      "msg": `${username} is not the teamleader`
    };
  } else if (gwUser.usedSecret) {
    res = {
      "enabled": true,
      "type": 'action',
      "msg": `${username} has already claimed the secret!`
    };
  } else {
    Overlays.emit('eventClaimed', {
      type: 'Secret',
      gang: gwUser.gang,
      user: username,
      event: gwEvent.name
    });
    gwUser.usedSecret = true;
    res = {
      "enabled": true,
      "type": 'action',
      "msg": `${username} ${getGangEmote(gwUser.gang)} CLAIMED THE SECRET!`
    };
  };
  return res;
};

const getGangEmote = (gang) => {
  return gang === 'red' ? settings.emoteRed : gang === 'blue' ? settings.emoteBlue : settings.emoteGreen
}

const getFromSE = (user) => {
  return new Promise((resolve, reject) => {
    fetch(`https://api.streamelements.com/kappa/v2/points/${setup.SE_ACCOUNTID}/${user}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${setup.SE_JWTTOKEN}`
        },
      })
      .then(response => {
        resolve(response.json());
      })
      .catch(error => {
        console.error('Error Getting Points: ', error)
        reject()
      });
  });
};

const putToSE = (user, points) => {
  fetch(`https://api.streamelements.com/kappa/v2/points/${setup.SE_ACCOUNTID}/${user}/${points}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${setup.SE_JWTTOKEN}`
      },
    })
    .then(response => {})
    .catch(error => console.error('Error Removing Points: ', error))
};

async function loadGSheetData() {
  let spreadID = gwSetup.gSheetId,
    sheetID = "1",
    targetCells = "A:H",
    APIKEY = gwSetup.gAPI,
    dataSource = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadID + "/values/Sheet" + (sheetID) + "!" + targetCells + "?key=" + APIKEY,
    tempUsers = [...gwUsers];

  const userDatabase = await fetch(dataSource)
    .then(response => response.json())
    .then(json => {
      if (json.error) {
        if (firstLoad) {
          gwUsers = JSON.parse(fs.readFileSync('./Gang Wars/hidden/GWusers.json'));
        };
        return (false)
      };

      gwUsers = [];
      json.values.forEach(user => {
        let userName = user[0].toLowerCase().trim();
        if (!firstLoad) { //check if mid game reload and save current progress
          let userIndex = tempUsers.findIndex(i => i.userName === userName);
          if (userIndex >= 0) {
            gwUsers.push(tempUsers[userIndex]);
            return;
          };
        };
        newUser = {};
        newUser.userName = userName
        newUser.gang = user[1].toLowerCase();
        newUser.lastStandard = ''
        newUser.usedSpecial = false;
        if (user[2] !== undefined) {
          newUser.usedSecret = false;
        }
        gwUsers.push(newUser);
      });
      fs.writeFileSync("./Gang Wars/hidden/GWusers.json", JSON.stringify(gwUsers, null, 4), "utf8");
      console.log('GangWars user database has loaded!')
      return (true)
    })
    .catch(error => {
      console.error("Error Getting Username Data from Google: ", error);
    });

  sheetID = "2"; // gid+1
  dataSource = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadID + "/values/Sheet" + (sheetID) + "!" + targetCells + "?key=" + APIKEY;

  const eventDatabase = await fetch(dataSource)
    .then(response => response.json())
    .then(json => {
      if (json.error) {
        if (firstLoad) {
          gwEvents = JSON.parse(fs.readFileSync('./Gang Wars/GWevents.json'));
        };
        return (false)
      };

      gwEvents = [];
      json.values.shift()
      json.values.forEach(event => {
        newEvent = {};
        newEvent.name = event[0];
        newEvent.type = event[1];
        newEvent.args = event[2] == "TRUE";
        newEvent.cooldown = parseInt(event[3]);
        newEvent.desc = event[4];
        gwEvents.push(newEvent);
      });
      fs.writeFileSync("./Gang Wars/GWevents.json", JSON.stringify(gwEvents, null, 4), "utf8");
      console.log('GangWars event database has loaded!')
      return (true)
    })
    .catch(error => {
      console.error("Error Getting Event Data from Google: ", error);
    });

  firstLoad = false;
  return userDatabase && eventDatabase ? {
    "enabled": true,
    "type": 'action',
    "msg": 'Gang Wars has been loaded!'
  } : {
    "enabled": true,
    "type": 'action',
    "msg": 'Error in Gang Wars database. Try again!'
  };
};
