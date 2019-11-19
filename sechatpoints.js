const tmi = require('tmi.js'); //Twitch chat plugin
const setup = require('./hidden/setup'); //setup information
const settings = require('./settings'); //settings information
const fetch = require('node-fetch'); //Webcall

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
    console.log(`Edit settings in settings.json file
      "enabled": ${settings.enabled},
      "subMode": ${settings.subMode}, //Only add to subs
      "chatInterval": ${settings.chatInterval}, //Chat timeframe in Seconds (30 second minimum)
      "chatNumber": ${settings.chatNumber}, //Number of nonconsecutive messages in timeframe
      "pointBonus": ${settings.pointBonus}, //Amount to points to add after timeframe
      "ignoredUsers": [${settings.ignoredUsers}], //Ignored Users Example
      "tellChat": ${settings.tellChat} //Announce most active person to chat
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
  if(self || !settings.enabled) return;  //Ignore messages from the bot & check if points are enabled.
  if(user['message-type'] === 'whisper') return; //Ingore Whispers to bot
//HARD CODE ROOM CHECK ... prevents drift (i.e. self-hosting follows a raid to new channel)
  if(room != setup.CHANNEL_NAME[0]) return;
// --------------

  if(settings.ignoredUsers.some(i=> i === user.username.toLowerCase())) return; //Ignore names in settings.json, LOWERCASE

  if(lastUser === user.username) return; //consecutive chat check; prevents 1 person spam & restarting timer. Must be 2+ users chatting.
  lastUser = user.username; //update lastUser

  if(settings.subMode && !user.subscriber ) return; //Sub mode check

  chattingUsers.push(user.username); //Add user to list of chatters


  if(timerRunning) return; //If timer is running, return.
  timerRunning = true;
  timer = setTimeout(() => updatePoints(chattingUsers,room), settings.chatInterval*1000 ); //Restart Timer when ended. Set time in Settings, SECONDS
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
    if(vaildUsers.indexOf(i) === -1 && numOfChats >= settings.chatNumber) { //if isn't already added + compare # of messages to Settings
      vaildUsers.push(i) //add user if above is true

      //for leader info
      if(numOfChats > leader[1]) {
        leader = [i, numOfChats]
      }
      //......
    }
  })
console.log('********** ', rateTesting, ' ***********')
console.log('Adding points to: ', vaildUsers.length, ' users') //testing
console.log(vaildUsers) //testing
console.log('most chats: ', leader[0], ' #: ', leader[1])
//  client.action(room, `NOT Updating Points...${vaildUsers}`).catch(err=>{console.log('Error: ', err)});
if(settings.tellChat){
  client.say(room, `Fun Fact: in the last ${settings.chatInterval / 60} minutes of chat, ${leader[0]} had the most non-consecutive messages: ${leader[1]}`).catch(err=>{console.log('Error sending Leader message to chat: ', err)});
}

let putMe = vaildUsers.map(i => { //format data to SE object
  return {
    "username": i,
    "current": settings.pointBonus
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
