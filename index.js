require("dotenv").config();
const { App } = require("@slack/bolt");
const axios = require("axios");
const cron = require("node-cron");

// nasa key from env or fallback
const NASA = process.env.NASA_API_KEY || "DEMO_KEY";

// boot up the bot in socket mode -- no public url needed
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// ------------------------------------------------
// little helper to grab today's date as YYYY-MM-DD
// ------------------------------------------------
function today() {
  return new Date().toISOString().split("T")[0];
}

// ------------------------------------------------
// daily digest -- pulls data from multiple apis
// and posts a summary to #space-alerts every morning
// ------------------------------------------------
async function sendDailyReport(channel) {
  try {
    // grab all three at the same time to save time
    const [apod, spacex, astronauts] = await Promise.all([
      axios.get(`https://api.nasa.gov/planetary/apod?api_key=${NASA}`),
      axios.get("https://api.spacexdata.com/v4/launches/latest"),
      axios.get("http://api.open-notify.org/astros.json"),
    ]);

    const msg = `
*Zenith Daily Space Report*

*Astronomy Picture of the Day*
${apod.data.title}
${apod.data.url}

*Latest SpaceX Launch*
Mission: ${spacex.data.name}
Date: ${new Date(spacex.data.date_utc).toDateString()}
Success: ${spacex.data.success ? "Yes" : "No"}

*People in Space right now*
${astronauts.data.number} astronauts aboard various spacecraft

Have a great day!
    `.trim();

    await app.client.chat.postMessage({ channel, text: msg });
  } catch (err) {
    console.log("daily report failed:", err.message);
  }
}

// ------------------------------------------------
// slash commands
// ------------------------------------------------

// ping -- just checks if bot is alive
app.command("/zenith-ping", async ({ ack, respond }) => {
  await ack();
  await respond("Pong! Zenith is online and ready.");
});

// apod -- astronomy picture of the day from nasa
app.command("/zenith-apod", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get(
      `https://api.nasa.gov/planetary/apod?api_key=${NASA}`
    );
    await respond(
      `*${res.data.title}*\n${res.data.explanation}\n${res.data.url}`
    );
  } catch (e) {
    await respond("Couldnt fetch APOD right now, try again in a bit.");
  }
});

// iss -- where is the space station right now
app.command("/zenith-iss", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("http://api.open-notify.org/iss-now.json");
    const { latitude, longitude } = res.data.iss_position;
    await respond(
      `ISS is currently at:\nLat: ${latitude}\nLon: ${longitude}\nMap: https://www.google.com/maps?q=${latitude},${longitude}`
    );
  } catch (e) {
    await respond("Couldnt fetch ISS location right now.");
  }
});

// spacex -- latest launch info
app.command("/zenith-spacex", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get(
      "https://api.spacexdata.com/v4/launches/latest"
    );
    const l = res.data;
    await respond(
      `*Latest SpaceX Launch*\nName: ${l.name}\nDate: ${new Date(l.date_utc).toDateString()}\nSuccess: ${l.success ? "Yes" : "No"}\nDetails: ${l.details || "No details available"}`
    );
  } catch (e) {
    await respond("Couldnt fetch SpaceX data.");
  }
});

// next launch -- whats coming up
app.command("/zenith-nextlaunch", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("https://api.spacexdata.com/v4/launches/next");
    const l = res.data;
    const diff = Math.round(
      (new Date(l.date_utc) - new Date()) / 1000 / 60 / 60
    );
    await respond(
      `*Next SpaceX Launch*\nMission: ${l.name}\nDate: ${new Date(l.date_utc).toDateString()}\nIn about: ${diff} hours`
    );
  } catch (e) {
    await respond("Couldnt fetch next launch info.");
  }
});

// mars -- latest curiosity rover photo
app.command("/zenith-mars", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get(
      `https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/latest_photos?api_key=${NASA}`
    );
    const photo = res.data.latest_photos[0];
    await respond(
      `Mars Rover: ${photo.rover.name}\nSol: ${photo.sol}\nCamera: ${photo.camera.full_name}\nPhoto: ${photo.img_src}`
    );
  } catch (e) {
    await respond("Couldnt fetch Mars photos.");
  }
});

// astronauts -- whos up there right now
app.command("/zenith-astronauts", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("http://api.open-notify.org/astros.json");
    const list = res.data.people
      .map((p) => `- ${p.name} (${p.craft})`)
      .join("\n");
    await respond(
      `People in space right now (${res.data.number} total):\n\n${list}`
    );
  } catch (e) {
    await respond("Couldnt fetch astronaut data.");
  }
});

// asteroids -- near earth objects today
app.command("/zenith-asteroids", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today()}&end_date=${today()}&api_key=${NASA}`
    );
    const asteroids = Object.values(res.data.near_earth_objects)[0];
    const dangerous = asteroids.filter(
      (a) => a.is_potentially_hazardous_asteroid
    );
    await respond(
      `Asteroids passing Earth today: ${asteroids.length}\nPotentially hazardous: ${dangerous.length}\n${dangerous.length > 0 ? "Stay safe out there!" : "All clear, nothing dangerous today."}`
    );
  } catch (e) {
    await respond("Couldnt fetch asteroid data.");
  }
});

// planet -- quick facts about any planet
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
    neptune: "Windiest planet. Takes 165 years to orbit the Sun.",
  };
  await respond(
    planets[name] ||
      "Planet not found. Try: mercury, venus, earth, mars, jupiter, saturn, uranus, neptune"
  );
});

// space-report -- quick summary of whats happening
app.command("/zenith-space-report", async ({ ack, respond }) => {
  await ack();
  try {
    const [spacex, astronauts] = await Promise.all([
      axios.get("https://api.spacexdata.com/v4/launches/latest"),
      axios.get("http://api.open-notify.org/astros.json"),
    ]);
    await respond(
      `*Space Report*\nLatest Launch: ${spacex.data.name}\nPeople in Space: ${astronauts.data.number}\nStatus: All systems nominal`
    );
  } catch (e) {
    await respond("Couldnt generate space report.");
  }
});

// help -- shows all commands
app.command("/zenith-help", async ({ ack, respond }) => {
  await ack();
  await respond(`*Zenith Bot Commands*

/zenith-ping          Check if bot is online
/zenith-apod          Astronomy Picture of the Day
/zenith-iss           Live ISS location on map
/zenith-spacex        Latest SpaceX launch info
/zenith-nextlaunch    Next upcoming SpaceX launch
/zenith-mars          Latest Mars rover photo
/zenith-astronauts    Who is in space right now
/zenith-asteroids     Near Earth asteroids today
/zenith-space-report  Quick space summary
/zenith-planet [name] Facts about a planet
/zenith-help          Show this menu`);
});

// ------------------------------------------------
// automated background tasks
// ------------------------------------------------

// daily report at 8am UTC every day
cron.schedule("0 8 * * *", () => {
  sendDailyReport("#space-alerts");
});

// check every 30 min if a launch is within 1 hour
cron.schedule("*/30 * * * *", async () => {
  try {
    const res = await axios.get("https://api.spacexdata.com/v4/launches/next");
    const launch = res.data;
    const minsLeft = (new Date(launch.date_utc) - new Date()) / 60000;

    // only alert when between 55-60 mins away so we dont spam
    if (minsLeft < 60 && minsLeft > 55) {
      await app.client.chat.postMessage({
        channel: "#space-alerts",
        text: `Launch in ~1 hour: ${launch.name}`,
      });
    }
  } catch (e) {
    // silently fail, dont want cron errors spamming logs
  }
});

// hourly asteroid danger check
cron.schedule("0 * * * *", async () => {
  try {
    const res = await axios.get(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today()}&end_date=${today()}&api_key=${NASA}`
    );
    const asteroids = Object.values(res.data.near_earth_objects)[0];
    const danger = asteroids.filter((a) => a.is_potentially_hazardous_asteroid);

    if (danger.length > 0) {
      await app.client.chat.postMessage({
        channel: "#space-alerts",
        text: `Asteroid Alert: ${danger.length} hazardous objects detected today`,
      });
    }
  } catch (e) {
    // silently fail
  }
});

// ------------------------------------------------
// start the bot
// ------------------------------------------------
(async () => {
  await app.start();
  console.log("Zenith bot is running!");
})();