const fs = require('fs'),
  fetch = require('node-fetch'), //Webcall
  setup = require('../hidden/setup'),
  settings = JSON.parse(fs.readFileSync('./Gang Wars/GWsettings.json')),
  gwUsers = JSON.parse(fs.readFileSync('./Gang Wars/GWusers.json')),
  io = require("socket.io"),
  Overlays = io.listen(7566);

let commandCost,
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
    //delete command message
    client.deletemessage(room, user.id).catch((err) => {
      //  console.log('delete error' + err)
    });
    let msgA = msg.toLowerCase().split(' '),
      res = '';
    msgA.shift() //remove command from message
    //enable/disable Commands
    if (isEditor) {
      if (msgA[0] === 'enable' || msgA[0] === 'start') {
        settings.enabled = true;
        res = 'Gang Wars is enabled!';
      } else if (msgA[0] === 'disable' || msgA[0] === 'stop') {
        settings.enabled = false;
        res = 'Gang Wars is disabled';
      };
      if (res !== '') {
        Overlays.emit('enabledCommand', settings.enabled);
        client.say(room, res).catch(err => {
          console.log('Error sending message to chat: ', err)
        });
      };
    };
    if (!settings.enabled) return; //enabled check
    //check user is in DB
    //TMI.js usernames are lowercase 'display-name': 'DaBearEnthusiast', uppercase
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
        res = `${gwUser.gang} gang is on cooldown for Standard Events`;
      } else if (new Date() - gwUser.lastStandard < settings.cooldownStandardUser * 60000) {
        res = `${user['display-name']} is on personal cooldown for Standard Events`;
      } else {
        //check user points
        let userData = await getFromSE(user.username); //get user data from Stream Elements
        let points = userData.points || -1; //Get points or -1 if not found
        if (points < 0) {
          res = `${user['display-name']} not found on Stream Elements leaderboard.`;
        } else if (points < settings.pointCostStandard) {
          res = `${user['display-name']} does not have enough peices. They have: ${points}`;
        } else {
          msgA.shift(); //remove "event"
          res = CharGangWarsEvent(msgA, user['display-name'], gwUser);
        };
      };
      //calling a special?
    } else if (msgA[0] === 'special') {

      //check user Gang timerRunning
      if (cooldownSpecial[gwUser.gang]) {
        res = `${gwUser.gang} gang is on cooldown for Special Events`;
      } else if (gwUser.usedSpecial) {
        res = `${user['display-name']} has already used their Special Event for this stream`;
      } else {
        //check user points
        let userData = await getFromSE(user.username); //get user data from Stream Elements
        let points = userData.points || -1; //Get points or -1 if not found
        if (points < 0) {
          res = `${user['display-name']} not found on Stream Elements leaderboard.`;
        } else if (points < settings.pointCostSpecial) {
          res = `${user['display-name']} does not have enough peices. They have: ${points}`;
        } else {
          msgA.shift() //remove "special"
          res = CharGangWarsSpecial(msgA, user['display-name'], gwUser)
        };
      };
    } else { //wrong parameter (not !GW event or !GW special)
      res = 'Use: !GW event <event> or !GW special <event>'
    };
    console.log(res)
    client.say(room, res).catch(err => {
      console.log('Error sending message to chat: ', err)
    });
    return;
  }
};

const CharGangWarsEvent = (msgA, username, gwUser) => {
  let res,
    notFound = `${msgA[0]} not found or missing <target>; Valid Commands: cpry.net/GWevents`;
  if (msgA.length === 1) {
    res = settings.eventStandard.untargeted[msgA[0]] || notFound
  } else {
    res = settings.eventStandard.targeted[msgA[0]] || notFound
  };
  if (res !== notFound) {
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
    res = `${username} [${gwUser.gang.toUpperCase()} GANG] used event: ${msgA[0].toUpperCase()}`
    putToSE(username, settings.pointCostStandard * -1); //remove points from user
  };
  return res;
};
const CharGangWarsSpecial = (msgA, username, gwUser) => {
  notFound = `${msgA[0]} not found; Valid Commands: cpry.net/GWevents`;
  let res = settings.eventSpecial[msgA[0]] || notFound;
  if (res !== notFound) {
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
    res = `${username} [${gwUser.gang.toUpperCase()} GANG] used special: ${msgA[0].toUpperCase()}`
    putToSE(username, settings.pointCostSpecial * -1); //remove points from user
  };
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
        //console.log(`Successfully Got Points from ${user}`)
        resolve(response.json());
      })
      .catch(error => {
        console.error('Error Getting Points: ', error)
        reject()
      });
  });
};
//save points
const putToSE = (user, points) => {
  fetch(`https://api.streamelements.com/kappa/v2/points/${setup.SE_ACCOUNTID}/${user}/${points}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${setup.SE_JWTTOKEN}`
      },
    })
    .then(response => { //console.log(`Successfully Removed Points from ${user}`)
    })
    .catch(error => console.error('Error Removing Points: ', error))
};
