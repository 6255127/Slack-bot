require("dotenv").config();

const { App } = require("@slack/bolt");
const axios = require("axios");
const cron = require("node-cron");

// openai is optional, wont break if u dont have a key
let openai;
try {
  const OpenAI = require("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (e) {
  console.log("OpenAI not enabled, thats fine");
}

// socket mode setup -- no public url needed
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const NASA_KEY = process.env.NASA_API_KEY || "DEMO_KEY"; // DEMO_KEY works for testing

/* ---------------------------
   AI digest generator
   falls back to plain text if no openai key
----------------------------*/
async function generateDigest(data) {
  if (!openai) {
    // simple fallback if no openai
    return `Space Update:
- Latest Launch: ${data.launches}
- People in Space: ${data.astronauts}
- Status: ${data.note}`;
  }

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `You are a NASA mission control AI. Summarize this concisely and make it exciting:
Launch: ${data.launches}
Astronauts in space: ${data.astronauts}
Notes: ${data.note}`
    }]
  });

  return res.choices[0].message.content;
}

/* ---------------------------
   SLASH COMMANDS
----------------------------*/

// /apod -- astronomy picture of the day
app.command("/zenith-apod", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}`);
    await respond({
      text: `*${res.data.title}*\n${res.data.explanation}\n${res.data.url}`
    });
  } catch (e) {
    await respond("couldnt fetch APOD right now, try again later");
  }
});

// /iss -- where is the space station right now
app.command("/zenith-iss", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("http://api.open-notify.org/iss-now.json");
    const { latitude, longitude } = res.data.iss_position;
    await respond(`ISS Location right now:
Lat: ${latitude}
Lon: ${longitude}
Map: https://www.google.com/maps?q=${latitude},${longitude}`);
  } catch (e) {
    await respond("couldnt fetch ISS location");
  }
});

// /spacex -- latest spacex launch info
app.command("/zenith-spacex", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("https://api.spacexdata.com/v4/launches/latest");
    const l = res.data;
    await respond(`*Latest SpaceX Launch*
Name: ${l.name}
Date: ${new Date(l.date_utc).toDateString()}
Success: ${l.success ? "Yes" : "No"}
Details: ${l.details || "No details available"}`);
  } catch (e) {
    await respond("couldnt fetch SpaceX data");
  }
});

// /mars -- latest photo from curiosity rover
app.command("/zenith-mars", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get(
      `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/latest_photos?api_key=${NASA_KEY}`
    );
    const photo = res.data.latest_photos[0];
    await respond(`Mars Rover: ${photo.rover.name}
Sol: ${photo.sol}
Camera: ${photo.camera.full_name}
Photo: ${photo.img_src}`);
  } catch (e) {
    await respond("couldnt fetch Mars photos");
  }
});

// /astronauts -- whos in space right now
app.command("/zenith-astronauts", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("http://api.open-notify.org/astros.json");
    const list = res.data.people.map(p => `- ${p.name} (${p.craft})`).join("\n");
    await respond(`People in space right now (${res.data.number} total):\n\n${list}`);
  } catch (e) {
    await respond("couldnt fetch astronaut data");
  }
});

// /asteroids -- near earth objects today
app.command("/zenith-asteroids", async ({ ack, respond }) => {
  await ack();
  try {
    const today = new Date().toISOString().split("T")[0];
    const res = await axios.get(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${NASA_KEY}`
    );
    const asteroids = Object.values(res.data.near_earth_objects)[0];
    const dangerous = asteroids.filter(a => a.is_potentially_hazardous_asteroid);
    await respond(`Asteroids passing Earth today: ${asteroids.length}
Potentially hazardous: ${dangerous.length}
${dangerous.length > 0 ? "Stay safe out there" : "All clear, nothing dangerous today"}`);
  } catch (e) {
    await respond("couldnt fetch asteroid data");
  }
});

// /space-report -- ai generated summary of whats happening in space
app.command("/zenith-space-report", async ({ ack, respond }) => {
  await ack();
  try {
    const [spacex, astronauts] = await Promise.all([
      axios.get("https://api.spacexdata.com/v4/launches/latest"),
      axios.get("http://api.open-notify.org/astros.json")
    ]);

    const digest = await generateDigest({
      launches: spacex.data.name,
      astronauts: astronauts.data.number,
      note: "All systems nominal"
    });

    await respond(`*Space Report*\n\n${digest}`);
  } catch (e) {
    await respond("couldnt generate space report");
  }
});

// /planet [name] -- quick facts about a planet
app.command("/zenith-planet", async ({ command, ack, respond }) => {
  await ack();
  const name = command.text.trim().toLowerCase();

  const planets = {
    mercury: "Closest planet to the Sun. No atmosphere, extreme temperatures.",
    venus: "Hottest planet in the solar system. Thick toxic atmosphere.",
    earth: "Our home. Only known planet with life.",
    mars: "The Red Planet. Has the tallest volcano in the solar system.",
    jupiter: "Largest planet. Has 95 known moons including Europa.",
    saturn: "Known for its stunning ring system. Less dense than water.",
    uranus: "Rotates on its side. Has faint rings and 27 moons.",
    neptune: "Windiest planet. Takes 165 years to orbit the Sun."
  };

  await respond(planets[name] || `Planet not found. Try: mercury, venus, earth, mars, jupiter, saturn, uranus, neptune`);
});

// /help -- shows all commands
app.command("/zenith-help", async ({ ack, respond }) => {
  await ack();
  await respond(`*Available Commands:*

| Command | Description |
|---|---|
| /apod | Astronomy Picture of the Day |
| /iss | Live ISS location on map |
| /spacex | Latest SpaceX launch info |
| /mars | Latest Mars rover photo |
| /astronauts | Who is in space right now |
| /asteroids | Near Earth asteroids today |
| /space-report | AI generated space digest |
| /planet [name] | Facts about a planet |
| /help | Show this menu |`);
});

/* ---------------------------
   AUTOMATED ALERTS
   these run in the background on a schedule
----------------------------*/

// checks every hour for dangerous asteroids
cron.schedule("0 * * * *", async () => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const res = await axios.get(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${NASA_KEY}`
    );
    const asteroids = Object.values(res.data.near_earth_objects)[0];
    const danger = asteroids.filter(a => a.is_potentially_hazardous_asteroid);

    if (danger.length > 0) {
      await app.client.chat.postMessage({
        channel: "#space-alerts",
        text: `Asteroid Alert: ${danger.length} hazardous objects detected today`
      });
    }
  } catch (e) {
    // silently fail, dont want cron errors spamming logs
  }
});

// checks every 30 min if a spacex launch is coming up soon
cron.schedule("*/30 * * * *", async () => {
  try {
    const res = await axios.get("https://api.spacexdata.com/v4/launches/next");
    const launch = res.data;
    const minutesUntilLaunch = (new Date(launch.date_utc) - new Date()) / 60000;

    // alert if launch is between 55 and 60 minutes away
    if (minutesUntilLaunch < 60 && minutesUntilLaunch > 55) {
      await app.client.chat.postMessage({
        channel: "#launches",
        text: `Launch in ~1 hour: ${launch.name}`
      });
    }
  } catch (e) {}
});

/* ---------------------------
   START
----------------------------*/
(async () => {
  await app.start();
  console.log("bot is running!");
})();