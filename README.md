# Zenith Bot 🚀

A Slack bot that brings live space data straight into your workspace. Track SpaceX launches, follow the ISS, get NASA photos, and more — all through slash commands.

---

## Commands

`/zenith-ping` — check if bot is alive

`/zenith-apod` — NASA astronomy picture of the day

`/zenith-iss` — live ISS location with google maps link

`/zenith-spacex` — latest SpaceX launch info

`/zenith-nextlaunch` — next upcoming launch + countdown

`/zenith-mars` — latest Mars rover photo

`/zenith-astronauts` — who is in space right now

`/zenith-asteroids` — near Earth asteroids today

`/zenith-space-report` — quick space summary

`/zenith-planet [name]` — facts about any planet

`/zenith-help` — show all commands

---

## Automated Alerts

- **Daily digest** posted to `#space-alerts` every morning at 8am UTC
- **Launch alert** sent 1 hour before any upcoming SpaceX launch
- **Asteroid warning** if any hazardous objects are detected that day

---

## Stack

- Node.js
- Slack Bolt (Socket Mode)
- NASA API
- SpaceX API
- Open Notify API
- node-cron
- Hosted on Hack Club Nest (24/7)

---

## Setup

1. Clone the repo
```bash
git clone https://github.com/6255127/Slack-bot
cd Slack-bot
npm install
```

2. Create a `.env` file
```plaintext
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
NASA_API_KEY=your-nasa-key
```

3. Run the bot
```bash
node index.js
```

---

## Getting Tokens

- **Slack tokens** — [api.slack.com/apps](https://api.slack.com/apps) → create an app → enable Socket Mode
- **NASA API key** — [api.nasa.gov](https://api.nasa.gov) → free signup

---


