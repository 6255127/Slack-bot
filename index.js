require("dotenv").config();
const { App } = require("@slack/bolt");
const axios = require("axios");
const cron = require("node-cron");

// nasa key from env or fallback to demo (rate limited)
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
// daily digest -- pulls data and posts every morning
// ------------------------------------------------
async function sendDailyReport(channel) {
  try {
    const [apod, astronauts] = await Promise.all([
      axios.get(`https://api.nasa.gov/planetary/apod?api_key=${NASA}`),
      axios.get("http://api.open-notify.org/astros.json"),
    ]);

    const msg = `
*Zenith Daily Space Report*

*Astronomy Picture of the Day*
${apod.data.title}
${apod.data.url}

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

// epic -- earth photo from nasa's EPIC camera (DSCOVR satellite)
// note: api.nasa.gov just redirects here so we hit it directly to avoid issues
app.command("/zenith-earth", async ({ ack, respond }) => {
  await ack();
  try {
    const res = await axios.get("https://epic.gsfc.nasa.gov/api/natural");
    const latest = res.data[res.data.length - 1]; // most recent image
    const date = latest.date.split(" ")[0].replace(/-/g, "/");
    const imageUrl = `https://epic.gsfc.nasa.gov/archive/natural/${date}/png/${latest.image}.png`;
    await respond(
      `*Earth right now, seen from space*\nCaptured: ${latest.date}\n${imageUrl}`
    );
  } catch (e) {
    await respond("Couldnt fetch Earth image right now.");
  }
});

// neo-lookup -- biggest asteroid approaching this week
app.command("/zenith-neo-week", async ({ ack, respond }) => {
  await ack();
  try {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    const res = await axios.get(
      `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startStr}&end_date=${endStr}&api_key=${NASA}`
    );

    // flatten all asteroids from all days into one list
    const allAsteroids = Object.values(res.data.near_earth_objects).flat();

    // find the biggest one by max diameter
    const biggest = allAsteroids.reduce((max, a) => {
      const size = a.estimated_diameter.meters.estimated_diameter_max;
      const maxSize = max.estimated_diameter.meters.estimated_diameter_max;
      return size > maxSize ? a : max;
    }, allAsteroids[0]);

    const sizeM = Math.round(
      biggest.estimated_diameter.meters.estimated_diameter_max
    );
    const closeApproach = biggest.close_approach_data[0];

    await respond(
      `*Biggest asteroid this week*\nName: ${biggest.name}\nEstimated size: up to ${sizeM}m wide\nCloses approach: ${closeApproach.close_approach_date}\nHazardous: ${biggest.is_potentially_hazardous_asteroid ? "Yes" : "No"}`
    );
  } catch (e) {
    await respond("Couldnt fetch weekly asteroid data.");
  }
});

// space-report -- quick summary of whats happening
app.command("/zenith-space-report", async ({ ack, respond }) => {
  await ack();
  try {
    const [apod, astronauts] = await Promise.all([
      axios.get(`https://api.nasa.gov/planetary/apod?api_key=${NASA}`),
      axios.get("http://api.open-notify.org/astros.json"),
    ]);
    await respond(
      `*Space Report*\nToday's Photo: ${apod.data.title}\nPeople in Space: ${astronauts.data.number}\nStatus: All systems nominal`
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
/zenith-astronauts    Who is in space right now
/zenith-asteroids     Near Earth asteroids today
/zenith-neo-week      Biggest asteroid approaching this week
/zenith-earth         Latest Earth photo from space
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
    // silently fail, dont want cron errors spamming logs
  }
});

// ------------------------------------------------
// start the bot
// ------------------------------------------------
(async () => {
  await app.start();
  console.log("Zenith bot is running!");
})();