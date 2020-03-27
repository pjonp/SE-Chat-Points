const GangWar = require('../GangWar.js');
//GangWar.main(client,room,user,msg, isEditor || user.mod)

const logTestResult = async (client, room, user, msg, isEditor) => {
  let res = await GangWar.main(client, room, user, msg, isEditor);
  console.log(res.msg);
};
// ENABLE DEV MODE BEFORE TESTING!
//  logTestResult('client','room','pjonp','!gw efk', true);
let testsArr = [
//start, then attempt to start with non mod
function () { console.log('1#########','Start Game:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pJonp'}, '!gw start', true) },
function () { console.log('2#########','Expect Fail: not editor:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw start', false) },
//not registered check
function () { console.log('3#########','Expect Fail: not on a team'), logTestResult('client', 'room', {username: 'notpj', 'display-name': 'notPJ'}, '!gw speed', false) },
//standard event checks
function () { console.log('4#########','Start Green Std:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw speed', false) },
function () { console.log('#########','Expect Fail: Green on Cooldown:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw speed', false) },
function () { console.log('#########','Expect Fail: STD <target> Required:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw yardtime', false) },
function () { console.log('#########','Start Red Std:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw yardtime green', false) },
function () { console.log('#########','Expect Fail: Red on STD Cooldown:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw yardtime green', false) },
function () { console.log('#########','Start Blue Std:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw speed', false) },
function () { console.log('#########','Expect Fail: Blue on STD Cooldown:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw speed', false) },
//special event checks
function () { console.log('#########','Expect Fail: SPEC <target> Required:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw silence', false) },
function () { console.log('#########','Start Red Spec:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw silence username', false) },
function () { console.log('#########','Expect Fail: Red on Spec Cooldown:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw silence username', false) },
function () { console.log('#########','Start Blue Spec:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw burn', false) },
function () { console.log('#########','Expect Fail: Blue on Spec Cooldown:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw breaktime', false) },
//Check reset command.... sped up
function () { console.log('#########','Start Green Special RESET (speed):'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw reset', false)},
function () { console.log('#########','Expect Fail: Green Special:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pJonp'}, '!gw burn', false) },
function () { console.log('#########','Expect Fail: Green Std:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pJonp'}, '!gw speed', false) },
//verify timers expired after reset/ check personal cool downs...
function () { console.log('#########','Expect Fail: personal Cooldown Green Std:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw speed', false) },
function () { console.log('#########','Expect Fail: personal Cooldown Red Std:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw yardtime green', false) },
function () { console.log('#########','Expect Fail: personal Cooldown Blue Std:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw speed', false) },
//verify specials are "already used"
function () { console.log('#########','Expect Fail: Spec Used Red:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw silence username', false) },
function () { console.log('#########','Expect Fail: Spec Used Blue:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw burn', false) },
// test togglespecial; allow a new reset
function () { console.log('#########','Expect Fail: non-mod togglespecial:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw togglespecial @pjonp', false) },
function () { console.log('#########','Toggle Green Spec:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw togglespecial @pjonp', true) },
function () { console.log('#########','Check toggle worked:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw reset', false)},
//test newgame & pop commands
function () { console.log('#########','Start New Game:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw newgame', true) },
function () { console.log('#########','Expect Fail: population requires a number:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw pop number', true) },
function () { console.log('#########','Set population to 50:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw pop 50', true) },
function () { console.log('#########','Expect Fail: <= 50:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw reinforcements', false) },
function () { console.log('#########','Set population to 51:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw pop 51', true) },
function () { console.log('#########','Expect Pass: pop > 50:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw reinforcements', true) },
function () { console.log('#########','Expect Fail: non mod startgame:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw newgame', false) },
//test toggle eliminated
function () { console.log('#########','Expect Fail: need target team:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw toggleEliminated', true) },
function () { console.log('#########','Expect Pass: toggle red:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw toggleEliminated ReD', true) },
function () { console.log('#########','Expect Pass: toggle blue:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw toggleEliminated bLUE', true) },
function () { console.log('#########','Expect Pass: use Green std:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw speed', false) },
function () { console.log('#########','Expect Pass: toggle green:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw toggleEliminated grEEn', true) },
//test std commands
function () { console.log('#########','Expect Fail: Green eliminated std:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw speed', false) },
function () { console.log('#########','Expect Fail: Red eliminated std:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw yardtime green', false) },
function () { console.log('#########','Expect Fail: Blue eliminated std:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw speed', false) },
//test special commands
function () { console.log('#########','Expect Fail: Green eliminated special:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw reinforcements', false) },
function () { console.log('#########','Expect Fail: Red eliminated special:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw reinforcements', false) },
function () { console.log('#########','Expect Fail: Blue eliminated special:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw reinforcements', false) },
//toggle back
function () { console.log('#########','Expect Pass: toggle red:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw toggleEliminated ReD', true) },
function () { console.log('#########','Expect Pass: toggle blue:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw toggleEliminated bLUE', true) },
function () { console.log('#########','Expect Pass: toggle green:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw toggleEliminated grEEn', true) },
//test std commands
function () { console.log('#########','Expect Fail: Green already used:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw speed', false) },
function () { console.log('#########','Expect Pass: Red std:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw yardtime green', false) },
function () { console.log('#########','Expect Pass: Blue std:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw speed', false) },
//test special commands
function () { console.log('#########','Expect Fail: Green already used special:'), logTestResult('client', 'room', {username: 'pjonp', 'display-name': 'pjonp'}, '!gw reinforcements', false) },
function () { console.log('#########','Expect Pass: Red special:'), logTestResult('client', 'room', {username: 'streamelements', 'display-name': 'streamelements'}, '!gw reinforcements', false) },
function () { console.log('#########','Expect Pass: Blue special:'), logTestResult('client', 'room', {username: 'pj_not_a_bot', 'display-name': 'pj_not_a_bot'}, '!gw reinforcements', false) },

]

let runTests = () => {
  if(testsArr.length === 0) {
    setTimeout(() => {
            console.log("Tests Completed")
    },2500)
    return;
  };
  setTimeout(() => {
      testsArr.shift().call()
      runTests();
  },5000)
};
runTests()
