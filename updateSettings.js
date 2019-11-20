
const fs = require('fs');
let settings = JSON.parse(fs.readFileSync('./settings.json'));

module.exports  = {
settings: settings,
update: async (client,room,msg) => {
msg = msg.toLowerCase().split(' ')
if(msg[0] != settings.chatCommand[0]) return;
msg.shift() //remove command from message
if(msg.length != 2 && msg[0] != 'help') {
  client.action(room, `Input Error: ${settings.chatCommand[0]} [setting] [value] for help use '${settings.chatCommand[0]} help'`).catch(err=>{console.log('Say Error: ', err)});
  return;
}
let aliasList = Object.values(settings).map(i => i[1]).flat();
let settingKey = Object.keys(settings).find(key => settings[key].flat().indexOf(msg[0]) >= 0 );
if(msg[0] == 'help' || !settingKey) {
  client.action(room, `Options: ${settings.chatCommand[0]} [${aliasList.join(' | ')}] [value]' `).catch(err=>{console.log('Say Error: ', err)});
  return;
}
let response = await updateSetting(settingKey,msg[0],msg[1])
client.say(room, `${response}`).catch(err=>{console.log('Error sending message to chat: ', err)});
}
};

async function updateSetting(key, alias, val){
  let currentVal = settings[key][0]
  if(typeof currentVal === 'boolean'){
    val = val.toLowerCase()
    val = val === 'true' || val === 'yes' || val === 'y' || val === 'on' ? true :  val === 'false' || val === 'no' || val === 'n' || val === 'off' ? false : val
    if(typeof val === 'boolean'){
      let msg = await saveFile(key, val)
      return msg
    }
    return `${settings['chatCommand'][0]} ${alias} is expecting 'true' or 'false'`;
  };
  if(typeof currentVal === 'number'){
    val = parseInt(val)
    if(val > 0){
      if(val < 30 && key === 'chatInterval'){
        return `${settings['chatCommand'][0]} ${alias} is expecting a number greater than 30`;
      }
      let msg = await saveFile(key, val)
      return msg
    }
      let minNum = key === 'chatInterval' ? 30 : 0
      return `${settings['chatCommand'][0]} ${alias} is expecting a number greater than ${minNum}`;
  }
  if(typeof currentVal === 'string'){
      let msg = await saveFile(key, val, 'string')
      return msg
  }
  if(typeof currentVal === 'object'){
    if(settings[key][1][0] == alias)
    {
      let msg = await saveFile(key, val, 'add')
      return msg
    }
      let msg = await saveFile(key, val, 'remove')
      return msg
  }
}

function saveFile(key, value, type){
  let msg = 'unknown error'
  if(type === 'add'){
    let currentUsers = settings[key][0]
      if(currentUsers.findIndex(i => i === value) >= 0){
        return `${value} already exists in: ${settings[key][1][0]}`
      }
    currentUsers.push(value)
    settings[key][0] = currentUsers
    msg = `${value} added to: ${settings[key][1][0]}!`
  }
  else if(type === 'remove'){
    let currentUsers = settings[key][0]
    let target = currentUsers.findIndex(i => i === value)
      if(target < 0){
        return `${value} does not exist in: ${settings[key][1][0]}`
      }
    if(currentUsers[0] === value || currentUsers[1] === value){
     return `${value} cannot be removed from this list.`
    }
    currentUsers.splice(target,1)
    settings[key][0] = currentUsers
    msg = `${value} removed from: ${settings[key][1][0]}!`
  }
  else if( type === 'string'){
    settings[key][0] = value
    msg = `${settings['chatCommand'][0]} is the new command!`
  }
  else{
    settings[key][0] = value
    msg = `${settings['chatCommand'][0]} ${settings[key][1]} has been set to ${settings[key][0]}`
}

  return new Promise( (resolve, reject) => {
  fs.writeFile('settings.json', JSON.stringify(settings, null, 2), (err) => {
  if (err) resolve(msg+' But there was an error saving the JSON file!');
  console.log('Settings file has been saved!' + msg);
  resolve(msg);
  });
}).catch(err => console.log('Promise error... ', err));
}
