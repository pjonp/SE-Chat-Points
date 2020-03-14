const tmi = require('tmi.js'); //Twitch chat plugin
const setup = require('./hidden/setup'); //setup information
const fetch = require('node-fetch'); //Webcall
const fs = require('fs'); //File System
const updateSettings = require('./updateSettings.js');
const CharGangWars = require('./CharGangWars.js');
let settings = updateSettings.settings;

//Twitch Login Settings
const options = {
  options: { debug: false }, //see info/chat in console. true to enable.
  connection: { reconnect: true }, //auto reconnect
  identity: {
    username: setup.BOT_USERNAME,
    password: setup.OAUTH_TOKEN
  },
  channels: setup.CHANNEL_NAME
};
const client = new tmi.client(options); // Create a Twitch Client


client.connect().then(function(data) { // Connect to Twitch
    console.log('SE Chat Point Bot Online');
    console.log(`
      ********${settings.chatCommand[0]}**********
      ${settings.chatCommand[1]} //Change main command
      ${settings.enabled[1]} : ${settings.enabled[0]} //true/false
      ${settings.subMode[1]} : ${settings.subMode[0]} //Only add to subs
      ${settings.chatInterval[1]} : ${settings.chatInterval[0]} //Chat timeframe in Seconds (30 second minimum)
      ${settings.chatNumber[1]} : ${settings.chatNumber[0]} //Number of nonconsecutive messages in timeframe
      ${settings.pointBonus[1]} : ${settings.pointBonus[0]} //Amount to points to add after timeframe
      ${settings.ignoredUsers[1]} : [${settings.ignoredUsers[0]}] //Ignored Users Example
      ${settings.editors[1]} : [${settings.editors[0]}] //Users that are allowed to change settings via chat commands
      ${settings.tellChat[1]} : ${settings.tellChat[0]} //Announce most active person to chat

      Edit settings in settings.json file

      `)
}).catch(function(err) {
    console.log('Twitch Connect Error');
});
client.on('connected', (addr, port) => {
  console.log(`* Connected to ${addr}:${port}`);
});
let timerRunning = false; //Set-up: false
let chattingUsers = []; //Set-up: []
let lastUser = ''; //Set-up: ''

client.on('message', (room, user, msg, self) => {
  if(self || user['message-type'] === 'whisper' || room != setup.CHANNEL_NAME[0] ) return;  //Ignore messages from the bot, whisps, and other rooms
  let isEditor = settings.editors[0].some(i=> i === user.username)
// --------------
  if(msg.toLowerCase().startsWith(CharGangWars.settings.chatCommand)){
    CharGangWars.main(client,room,user,msg,isEditor)
  }
// --------------
  if(isEditor) { //If editor check for a command
    updateSettings.update(client,room,msg);
  }
  if(!settings.enabled[0]) return;  //Check if system is enabled.
  if(settings.ignoredUsers[0].some(i=> i === user.username) || lastUser === user.username) return; //Ignore names in settings.json & consecutive chats
  lastUser = user.username; //update lastUser
  if(settings.subMode[0] && !user.subscriber ) return; //Sub mode check
  chattingUsers.push(user.username); //Add user to list of chatters
  if(timerRunning) return; //If timer is running, return.
  timerRunning = true;
  console.log(`***new session started for ${settings.chatInterval[0]} seconds`)
  timer = setTimeout(() => updatePoints(chattingUsers,room), settings.chatInterval[0]*1000 ); //Restart Timer when ended. Set time in Settings, SECONDS
});

function updatePoints(users,room){
  chattingUsers = [] //reset chatters
  timerRunning = false; //reset timer varible
  if(!users[0]) return //Prevent Emptyset errors.
  //message testing
  let rateTesting = users.length //VAILD MESSAGE COUNT
  //...testing
  users.sort()//alphabetize all users
  let vaildUsers = [] //empty set for counting
//
  let leader = ['no one', 0] //leader set-up
//
  users.forEach(i =>{
    let numOfChats = users.lastIndexOf(i) - users.indexOf(i) + 1

    //for leader info
    if(numOfChats > leader[1]) {
      leader = [i, numOfChats]
      }
    //......
    if(vaildUsers.indexOf(i) === -1 && numOfChats >= settings.chatNumber[0]) { //if isn't already added + compare # of messages to Settings
      vaildUsers.push(i) //add user if above is true
    }
  })
console.log('********** ', rateTesting, ' ***********')
console.log('Adding points to: ', vaildUsers.length, ' users') //testing
console.log(vaildUsers) //testing
console.log('most chats: ', leader[0], ' #: ', leader[1])
//  client.action(room, `NOT Updating Points...${vaildUsers}`).catch(err=>{console.log('Error: ', err)});
if(vaildUsers.length < 1){
  console.log(`No user had more than ${settings.chatNumber[0]} chats`,`...waiting to start new session`)
  return
}
if(settings.tellChat[0]){
  client.say(room, `Fun Fact: in the last ${settings.chatInterval[0] / 60} minutes of chat, ${leader[0]} had the most non-consecutive messages: ${leader[1]}`).catch(err=>{console.log('Error sending Leader message to chat: ', err)});
}

let putMe = vaildUsers.map(i => { //format data to SE object
  return {
    "username": i,
    "current": settings.pointBonus[0]
  }
})

  //send to Stream Elements...
  //BULK ADD POINTS
  putToSE(`https://api.streamelements.com/kappa/v2/points/${setup.SE_ACCOUNTID}/`, //Stream Elements Account ID (from dashboard)
  {                         //'body' object formatted for SE
    "mode": "add",
    "users": putMe
  })
};

function putToSE(url, data) {
  return fetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json',
               'Authorization': `Bearer ${setup.SE_JWTTOKEN}`}, //Stream Elements Secret 'JWT' Token (from dashboard)
  })
  .then(response => console.log('Successfully Updated Leaderboard'))
  .catch(error => console.error('Error Updating: ', error))
}
