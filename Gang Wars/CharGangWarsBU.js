const fs = require('fs'),
  fetch = require('node-fetch'), //Webcall
  setup = require('../hidden/setup'),
  settings = JSON.parse(fs.readFileSync('./Gang Wars/GWsettings.json')),
  gwSetup = JSON.parse(fs.readFileSync('./Gang Wars/hidden/GWsetup.json')),
  io = require("socket.io"),
  Overlays = io.listen(7566);

let gwUsers = JSON.parse(fs.readFileSync('./Gang Wars/hidden/GWusers.json')),
  gwEvents = JSON.parse(fs.readFileSync('./Gang Wars/GWevents.json')),
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
  };

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
    //enable/disable Commands
    if (isEditor) {
      if (msgA[0] === 'enable' || msgA[0] === 'start') {
        settings.enabled = true;
        res = {
          "enabled": true,
          "type": 'say',
          "msg": 'Gang Wars is enabled!'
        };
      } else if (msgA[0] === 'disable' || msgA[0] === 'stop') {
        settings.enabled = false;
        res = {
          "enabled": true,
          "type": 'say',
          "msg": 'Gang Wars is disabled'
        };
      };
      if (res.msg !== '') {
        Overlays.emit('enabledCommand', settings.enabled);
        client.say(room, res.msg).catch(err => {
          console.log('Error sending message to chat: ', err)
        });
      };
    };
    if (!settings.enabled) return; //enabled check
    //check user is in DB
    //TMI.js usernames are lowercase 'display-name': 'Pjonp', uppercase
    //Database must be lowercase usernames!
    let userIndex = gwUsers.findIndex(i => i.userName === user.username);
    if (userIndex < 0) {
      res = `${user['display-name']} not registered in Gang Wars`
      client.say(room, res).catch(err => {
        console.log('Error sending message to chat: ', err)
      });
      return;
    }
    let gwUser = gwUsers[userIndex];

    //Calling an event?
    if (msgA[0] === 'event') {
      //check user Gang timerRunning
      if (cooldownStandard[gwUser.gang]) {
        res = {
          "enabled": true,
          "type": 'say',
          "msg": `${gwUser.gang} gang is on cooldown for Standard Events`
        };
      } else if (new Date() - gwUser.lastStandard < settings.cooldownStandardUser * 60000) {
        res = {
          "enabled": true,
          "type": 'say',
          "msg": `${user['display-name']} is on personal cooldown for Standard Events`
        };
      } else {
        //check user points
        let userData = await getFromSE(user.username); //get user data from Stream Elements
        let points = userData.points || -1; //Get points or -1 if not found
        if (points < 0) {
          res = {
            "enabled": true,
            "type": 'say',
            "msg": `${user['display-name']} not found on Stream Elements leaderboard.`
          };
        } else if (points < settings.pointCostStandard) {
          res = {
            "enabled": true,
            "type": 'say',
            "msg": `${user['display-name']} does not have enough peices. They have: ${points}`
          };
        } else {
          msgA.shift(); //remove "event"
          res = CharGangWarsEvent(msgA, user['display-name'], gwUser);
        };
      };
      //calling a special?
    } else if (msgA[0] === 'special') {

      //check user Gang timerRunning
      if (cooldownSpecial[gwUser.gang]) {
        res = {
          "enabled": true,
          "type": 'say',
          "msg": `${gwUser.gang} gang is on cooldown for Special Events`
        };
      } else if (gwUser.usedSpecial) {
        res = {
          "enabled": true,
          "type": 'say',
          "msg": `${user['display-name']} has already used their Special Event for this stream`
        };
      } else {
        //check user points
        let userData = await getFromSE(user.username); //get user data from Stream Elements
        let points = userData.points || -1; //Get points or -1 if not found
        if (points < 0) {
          res = {
            "enabled": true,
            "type": 'say',
            "msg": `${user['display-name']} not found on Stream Elements leaderboard.`
          };
        } else if (points < settings.pointCostSpecial) {
          res = {
            "enabled": true,
            "type": 'say',
            "msg": `${user['display-name']} does not have enough peices. They have: ${points}`
          };
        } else {
          msgA.shift() //remove "special"
          res = CharGangWarsSpecial(msgA, user['display-name'], gwUser)
        };
      };
    } else { //wrong parameter (not !GW event or !GW special)
      res = {
        "enabled": true,
        "type": 'say',
        "msg": 'Use: !GW event <event> or !GW special <event>'
      };
    };
    console.log(res.msg)
    client.say(room, res.msg).catch(err => {
      console.log('Error sending message to chat: ', err)
    });
    return;
  }
};

const CharGangWarsEvent = (msgA, username, gwUser) => {
  let res;
  if (msgA.length === 1) {
    res = gwEvents.eventStandard.untargeted[msgA[0]] || null
  } else {
    res = gwEvents.eventStandard.targeted[msgA[0]] || null
  };
  if (res) {
    cooldownStandard[gwUser.gang] = setTimeout(() => {
      console.log(`EVENT COOLDOWN OVER FOR ${gwUser.gang.toUpperCase()} GANG`)
      cooldownStandard[gwUser.gang] = false;
    }, settings.cooldownStandardGlobal * 60000);
    Overlays.emit('startTimer', {
      type: 'Event',
      gang: gwUser.gang,
      length: (settings.cooldownStandardGlobal * 60 + settings.coolddownOverlayDelay)
    });
    gwUser.lastStandard = new Date();
    res = {
      "enabled": true,
      "type": 'say',
      "msg": `${username} [${gwUser.gang.toUpperCase()} GANG] used event: ${msgA[0].toUpperCase()}`
    };
    putToSE(username, settings.pointCostStandard * -1); //remove points from user
  } else {
    res = {
      "enabled": true,
      "type": 'say',
      "msg": `${msgA[0]} not found or missing <target>; Valid Commands: cpry.net/GWevents}`
    };
  }
  return res;
};
const CharGangWarsSpecial = (msgA, username, gwUser) => {
  let res = gwEvents.eventSpecial[msgA[0]] || null;
  if (res) {
    cooldownSpecial[gwUser.gang] = setTimeout(() => {
      console.log(`SPECIAL COOLDOWN OVER FOR ${gwUser.gang.toUpperCase()} GANG`)
      cooldownSpecial[gwUser.gang] = false;
    }, settings.cooldownSpecialGlobal * 60000);
    Overlays.emit('startTimer', {
      type: 'Special',
      gang: gwUser.gang,
      length: (settings.cooldownSpecialGlobal * 60 + settings.coolddownOverlayDelay)
    });
    gwUser.usedSpecial = true;
    res = {
      "enabled": true,
      "type": 'say',
      "msg": `${username} [${gwUser.gang.toUpperCase()} GANG] used special: ${msgA[0].toUpperCase()}`
    };
    putToSE(username, settings.pointCostSpecial * -1); //remove points from user
  } else {
    res = {
      "enabled": true,
      "type": 'say',
      "msg": `${msgA[0]} not found; Valid Commands: cpry.net/GWevents`
    };
  }
  return res;
};

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



let spreadID = "1e40gHf8b50EKgSx3SkrCSOIkkpDEAii1IFoRxpJE4Hc";
let sheetID = "1"; // gid+1
let targetCells = "A:C";
let APIKEY = gwSetup.gAPI;
let dataSource = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadID + "/values/Sheet" + (sheetID) + "!" + targetCells + "?key=" + APIKEY;


fetch(dataSource)
  .then(response => response.json())
  .then(json => {
    gwUsers = [];
    json.values.forEach(user => {
      newUser = {};
      newUser.userName = user[0].toLowerCase().trim();
      newUser.gang = user[1].toLowerCase();
      newUser.lastStandard = "";
      newUser.usedSpecial = false;
      if (user[2] !== undefined) {
        newUser.usedSecret = false;
      }
      gwUsers.push(newUser);
    });
    fs.writeFileSync("./Gang Wars/hidden/GWusers.json", JSON.stringify(gwUsers, null, 4), "utf8").catch(error => {
      console.error("Error Writing DataBase: ", error);
    })
  })
  .catch(error => {
    console.error("Error Getting Username Data from Google: ", error);
  });
/////////
/*
 spreadID = "13XY4h7aokMWWZddRVtsaw2K8PgMAJkkpHrMIY1gWkt0";
 sheetID = "1"; // gid+1
 targetCells = "A:E";
 dataSource = "https://sheets.googleapis.com/v4/spreadsheets/"+spreadID+"/values/Sheet"+(sheetID)+"!"+targetCells+"?key="+APIKEY;

fetch(dataSource)
            .then(response => response.json())
            .then(json => {
                eventData = {events:[]};
                json.values.shift()
                json.values.forEach(event => {
                    newEvent = {};
                    newEvent.name = event[0];
                    newEvent.type = event[1];
                    newEvent.args = event[2] == "TRUE";
                    newEvent.cooldown = parseInt(event[3]);
                    newEvent.desc = event[4];
                    eventData.events.push(newEvent);
                });
                fs.writeFileSync("./Gang Wars/GWevents.json", JSON.stringify(eventData, null, 4), "utf8");
            })
            .catch(error => {
                cconsole.error("Error Getting Event Data from Google: ", error);
            });
*/
