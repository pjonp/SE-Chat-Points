#### GangWar Chat Game w/ Stream Elements Points (Twitch)
***
This bot will allow users to interact with chat commands

#### Set-Up:
1) Rename the file in the hidden folder to `setup.json`
2) Edit the information in `hidden/GWsetup.json`
3) Review information in `GWsettings.json` and edit as wanted


#### MOD / EDITOR COMMANDS:
 - !gw start - start or reload settings, keeps current progress (player usage & timers) but reloads new info from the sheets
 - !gw stop - pause a game (doesn't stop timers, just prevents new commands)
 - !gw togglespecial @user - toggles a players special status: can remove or add back a special (does not affect timers)
 - !gw pop <number> - tells bot in-game number. will reject commands that require a min population, i.e reinforcements will be prevented if <51  (screenshot above)
 - !gw toggleeliminated <color> - will eliminate a gang from using commands and remove their timers. If already eliminated, will enable commands and bring timers back
 - !gw newgame - start a NEW game. all player data is reset and sheet info reloaded
