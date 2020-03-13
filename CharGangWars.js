const fs = require('fs'),
  fetch = require('node-fetch'), //Webcall
  setup = require('./hidden/setup'),
  settings = JSON.parse(fs.readFileSync('./GWsettings.json')),
  gwUsers = JSON.parse(fs.readFileSync('./GWusers.json'));
//get user database
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

module.exports = {
  settings: settings,
  main: async (client, room, user, msg) => {
    //delete command message
    client.deletemessage(room, user.id).catch((err) => {
      console.log('delete error' + err)
    });
    //check user is in DB
    let userIndex = gwUsers.findIndex(i => i.userName === user.username);
    if (userIndex < 0) {
      let res = `${user.username} not registered in Gang Wars`
      client.say(room, res).catch(err => {
        console.log('Error sending message to chat: ', err)
      });
      return;
    }
    let gwUser = gwUsers[userIndex],
      msgA = msg.toLowerCase().split(' '),
      res = '';
    msgA.shift() //remove command from message

    //Calling an event?
    if (msgA[0] === 'event') {
      //check user Gang timerRunning
      if (cooldownStandard[gwUser.gang]) {
        res = `${gwUser.gang} gang is on cooldown for Standard Events`;
      } else if (new Date() - gwUser.lastStandard < settings.cooldownStandardUser * 60000) {
        res = `${user.username} is on personal cooldown for Standard Events`;
      } else {
        //check user points
        let userData = await getFromSE(user.username); //get user data from Stream Elements
        let points = userData.points || -1; //Get points or -1 if not found
        if (points < 0) {
          res = `${user.username} not found on Stream Elements leaderboard.`;
        } else if (points < settings.pointCostStandard) {
          res = `${user.username} does not have enough peices. They have: ${points}`;
        } else {
          msgA.shift(); //remove "event"
          res = CharGangWarsEvent(msgA, user.username, gwUser);
        };
      };
      //calling a special?
    } else if (msgA[0] === 'special') {

      //check user Gang timerRunning
      if (cooldownSpecial[gwUser.gang]) {
        res = `${gwUser.gang} gang is on cooldown for Special Events`;
      } else if (gwUser.usedSpecial) {
        res = `${user.username} has already used their Special Event for this stream`;
      } else {
        //check user points
        let userData = await getFromSE(user.username); //get user data from Stream Elements
        let points = userData.points || -1; //Get points or -1 if not found
        if (points < 0) {
          res = `${user.username} not found on Stream Elements leaderboard.`;
        } else if (points < settings.pointCostSpecial) {
          res = `${user.username} does not have enough peices. They have: ${points}`;
        } else {
          msgA.shift() //remove "special"
          res = CharGangWarsSpecial(msgA, user.username, gwUser)
        };
      };
    } else { //wrong parameter (not !GW event or !GW special)
      res = 'Use: !GW event <event> or !GW special <event>'
    };
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
      console.log('STD COOL OFF')
      cooldownStandard[gwUser.gang] = false;
    }, settings.cooldownStandardGlobal * 60000);
    gwUser.lastStandard = new Date();
    res = `${username} [${gwUser.gang.toUpperCase()} GANG] used: ${res}`
    putToSE(username, settings.pointCostStandard * -1); //remove points from user

  };
  return res;
};
const CharGangWarsSpecial = (msgA, username, gwUser) => {
  notFound = `${msgA[0]} not found; Valid Commands: cpry.net/GWevents`;
  let res = settings.eventSpecial[msgA[0]] || notFound;
  if (res !== notFound) {
    cooldownSpecial[gwUser.gang] = setTimeout(() => {
      console.log('SPECIAL COOL OFF')
      cooldownSpecial[gwUser.gang] = false;
    }, settings.cooldownSpecialGlobal * 60000);
    gwUser.usedSpecial = true;
    res = `${username} [${gwUser.gang.toUpperCase()} GANG] used: ${res}`
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
        console.log(`Successfully Got Points from ${user}`)
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
  return fetch(`https://api.streamelements.com/kappa/v2/points/${setup.SE_ACCOUNTID}/${user}/${points}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${setup.SE_JWTTOKEN}`
      },
    })
    .then(response => console.log(`Successfully Removed Points from ${user}`))
    .catch(error => console.error('Error Updating: ', error))
};
