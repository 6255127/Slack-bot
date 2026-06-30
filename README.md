# Zenith 🚀 #
 
I built a Slack bot to bring space data into your workspace. Type a command, get real-time info on SpaceX launches, the ISS, NASA photos, asteroids, whatever is going up there right now.
 
Been watching spacex launches for years and wanted to combine that with coding so here we are
Commands :
`/zenith-ping` - check if its alive
 
`/zenith-apod` - NASA's photo of the day
 
`/zenith-iss` - where the space station is right now
 
`/zenith-spacex` - latest launch
 
`/zenith-nextlaunch` - whats coming up next
 
`/zenith-mars` - latest pic from the Curiosity rover
 
`/zenith-astronauts` - whos in space right now
 
`/zenith-asteroids` - any asteroids near earth today
 
`/zenith-space-report` - quick rundown of everything
 
`/zenith-planet mars` - facts about any planet
 
`/zenith-help` - shows this list

 
Posts a daily digest to #space-alerts every morning at 8am, and pings the channel an hour before any SpaceX launch.
Built with:
Node.js, Slack’s Bolt library, NASA’s API, SpaceX’s API. Runs on Hack Club Nest 24/7 with systemd.
 
