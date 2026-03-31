const express = require("express");
const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());


const API_KEY = "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";
const BTC_BUCKETS_DATA_SOURCE_ID = "329b26a4-3077-808e-b870-000b9ddd1274";
const BTC_TASKS_DATA_SOURCE_ID = "312b26a4-3077-8071-b771-000b9f20bebf";


app.post("/tweet", async (req, res) => {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret, text, mediaId } = req.body;
 
  try {
    const oauth = OAuth({
      consumer: { key: consumerKey, secret: consumerSecret },
      signature_method: "HMAC-SHA1",
      hash_function(base_string, key) {
        return crypto.createHmac("sha1", key).update(base_string).digest("base64");
      },
    });
 
    const token = { key: accessToken, secret: accessTokenSecret };
 
    const requestData = {
      url: "https://api.twitter.com/2/tweets",
      method: "POST",
    };
 
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
 
    const payload = { text };
    if (mediaId) {
      payload.media = { media_ids: [mediaId] };
    }
 
    const response = await axios.post(
      requestData.url,
      payload,
      {
        headers: {
          Authorization: authHeader["Authorization"],
          "Content-Type": "application/json",
          "User-Agent": "MyTwitterApp/1.0",
        },
      }
    );

    console.log(response.data);
 
    res.json(response.data);
  } catch (err) {
    console.error("Error posting tweet:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

app.post("/reply", async (req, res) => {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret, text, replyToTweetId } = req.body;

  if (!text || !replyToTweetId || !accessToken || !accessTokenSecret) {
    return res.status(400).json({ 
      error: "text, replyToTweetId, accessToken and accessTokenSecret are required" 
    });
  }

  try {
    const oauth = OAuth({
      consumer: {
        key: consumerKey,
        secret: consumerSecret,
      },
      signature_method: "HMAC-SHA1",
      hash_function(base_string, key) {
        return crypto.createHmac("sha1", key).update(base_string).digest("base64");
      },
    });

    const token = { key: accessToken, secret: accessTokenSecret };
    const requestData = { url: "https://api.twitter.com/2/tweets", method: "POST" };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const response = await axios.post(
      requestData.url,
      {
        text,
        reply: {
          in_reply_to_tweet_id: replyToTweetId,
        },
      },
      {
        headers: {
          Authorization: authHeader["Authorization"],
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});


app.post("/upload-media-from-url", async (req, res) => {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret, imageUrl } = req.body;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret || !imageUrl) {
    return res.status(400).json({
      error: "consumerKey, consumerSecret, accessToken, accessTokenSecret and imageUrl are required",
    });
  }

  try {
    // 1. Download image as binary buffer
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(imageResponse.data);
    const contentType = imageResponse.headers["content-type"] || "image/jpeg";

    // 2. Manually build multipart/form-data body — no FormData package needed
    const boundary = "----TwitterBoundary" + Date.now();

    const part1 = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media_category"\r\n\r\n` +
      `tweet_image\r\n`
    );

    const part2Header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media"; filename="image"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );

    const part2Footer = Buffer.from(`\r\n--${boundary}--\r\n`);

    const body = Buffer.concat([part1, part2Header, imageBuffer, part2Footer]);

    // 3. OAuth sign — no body params for multipart
    const UPLOAD_URL = "https://api.x.com/2/media/upload";

    const oauth = OAuth({
      consumer: { key: consumerKey, secret: consumerSecret },
      signature_method: "HMAC-SHA1",
      hash_function(base_string, key) {
        return crypto.createHmac("sha1", key).update(base_string).digest("base64");
      },
    });

    const token = { key: accessToken, secret: accessTokenSecret };
    const authHeader = oauth.toHeader(
      oauth.authorize({ url: UPLOAD_URL, method: "POST" }, token)
    );

    // 4. Post raw buffer
    const uploadResponse = await axios.post(UPLOAD_URL, body, {
      headers: {
        Authorization: authHeader["Authorization"],
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
    });

    const mediaId = uploadResponse.data?.data?.id;
    console.log("Uploaded media id:", mediaId);

    res.json({ media_id_string: mediaId, raw: uploadResponse.data });
  } catch (err) {
    console.error("Error uploading media:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: err.message }
    );
  }
});


//Notion API routes

async function getBuckets(filterByClientId = null) {
  try {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${BTC_BUCKETS_DATA_SOURCE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2025-09-03"
      },
      body: JSON.stringify({ page_size: 100 })
    });

    const data = await response.json();

    let buckets = data.results.map(page => {
      const props = page.properties;
      const totalPoints = props["Total Points"].rollup.number;
      const completedValue = props["Completed Value"].rollup.number;
      const progressDecimal = props["Progress %"].formula.number;

      return {
        id: page.id,
        name: props["Name"].title[0]?.plain_text ?? "Untitled",
        icon: page.icon?.emoji ?? null,
        progressPercent: (progressDecimal * 100).toFixed(2) + "%",
        completedPoints: completedValue,
        totalPoints: totalPoints,
        clientIds: props["👥 BTC Clients"].relation.map(r => r.id)
      };
    });

    if (filterByClientId) {
      buckets = buckets.filter(bucket =>
        bucket.clientIds.includes(filterByClientId)
      );
    }

    return buckets;

  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function getClients() {
  try {
    const response = await fetch(`https://api.notion.com/v1/data_sources/312b26a4-3077-800e-9a05-000bac5f3971/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2025-09-03"
      },
      body: JSON.stringify({ page_size: 100 })
    });

    const data = await response.json();

    const clients = data.results.map(page => {
      const props = page.properties;
      return {
        id: page.id,
        name: props["Name"].title[0]?.plain_text ?? "Untitled",
        status: props["Status"]?.status?.name ?? null,
        email: props["Email"]?.email ?? null,
        phone: props["Phone"]?.phone_number ?? null,
        overallProgress: (props["Overall Progress"]?.formula?.number * 100).toFixed(2) + "%" ?? null,
        totalPoints: props["Total Points"]?.rollup?.number ?? null,
        completedPoints: props["Completed Points"]?.rollup?.number ?? null,
        contractStartDate: props["Contract Start Date"]?.date?.start ?? null,
        contractEndDate: props["Contract End Date"]?.date?.end ?? null,
      };
    });

    return clients;

  } catch (error) {
    console.error("Error:", error.message);
  }
}

const HEADERS = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
  "Notion-Version": "2025-09-03"
};

async function getTasks() {
  try {
    const response = await fetch(
      `https://api.notion.com/v1/data_sources/${BTC_TASKS_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ page_size: 100 })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Notion API Error");
    }

    return data.results.map(page => {
      const props = page.properties;

      return {
        id: page.id,
        name: props["Name"]?.title[0]?.plain_text || "Untitled",
        points: props["Points"]?.number || 0,
        completedPoints: props["Completed Points"]?.formula?.number || 0,
        stage: props["Stage"]?.status?.name || null,
        clientIds: props["BTC Clients"]?.relation?.map(r => r.id) || [],
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time
      };
    });

  } catch (error) {
    console.error("❌ Error fetching tasks:", error.message);
    throw error;
  }
}

// ===== CORE LOGIC =====
function getMonthlyAverage(tasks, clientId) {
  // 1. Filter by client
  const filtered = tasks.filter(task =>
    task.clientIds.includes(clientId)
  );

  const monthlyMap = {};

  filtered.forEach(task => {
    if (!task.createdTime) return;

    const date = new Date(task.createdTime);

    const monthKey = date.toLocaleString('default', {
      month: 'short',
      year: 'numeric'
    });

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        totalCompletedPoints: 0,
        completedTasks: 0,
        dateObj: new Date(date.getFullYear(), date.getMonth(), 1)
      };
    }

    // Only completed tasks
    if (task.completedPoints > 0) {
      monthlyMap[monthKey].totalCompletedPoints += task.completedPoints;
      monthlyMap[monthKey].completedTasks += 1;
    }
  });

  // 2. Convert to sorted array
  const result = Object.keys(monthlyMap)
    .map(month => {
      const m = monthlyMap[month];

      return {
        month,
        totalCompletedPoints: m.totalCompletedPoints,
        completedTasks: m.completedTasks,
        averagePoints:
          m.completedTasks > 0
            ? (m.totalCompletedPoints / m.completedTasks).toFixed(2)
            : "0.00",
        date: m.dateObj
      };
    })
    .sort((a, b) => a.date - b.date)
    .map(({ date, ...rest }) => rest);

  return result;
}

async function getBuckets(filterByClientId = null) {
  try {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${BTC_BUCKETS_DATA_SOURCE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2025-09-03"
      },
      body: JSON.stringify({ page_size: 100 })
    });

    const data = await response.json();

    let buckets = data.results.map(page => {
      const props = page.properties;
      const totalPoints = props["Total Points"].rollup.number;
      const completedValue = props["Completed Value"].rollup.number;
      const progressDecimal = props["Progress %"].formula.number;

      return {
        id: page.id,
        name: props["Name"].title[0]?.plain_text ?? "Untitled",
        icon: page.icon?.emoji ?? null,
        progressPercent: (progressDecimal * 100).toFixed(2) + "%",
        completedPoints: completedValue,
        totalPoints: totalPoints,
        clientIds: props["👥 BTC Clients"].relation.map(r => r.id)
      };
    });

    if (filterByClientId) {
      buckets = buckets.filter(bucket =>
        bucket.clientIds.includes(filterByClientId)
      );
    }

    return buckets;

  } catch (error) {
    console.error("Error:", error.message);
  }
}

getBuckets().then(buckets => {
  console.log(JSON.stringify(buckets, null, 2));
});


app.get('/clients/:clientId/buckets', async (req, res) => {
  try {
    const { clientId } = req.params;

    const buckets = await getBuckets(clientId);

    res.json({
      clientId,
      total: buckets.length,
      data: buckets
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/client/:clientId/monthly-average', async (req, res) => {
  try {
    const { clientId } = req.params;

    const tasks = await getTasks();

    const data = getMonthlyAverage(tasks, clientId);

    res.json({
      clientId,
      months: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


app.get('/client/:clientId', async (req, res) => {
  const clients = await getClients();
  const client = clients.find(c => c.id === req.params.clientId);
  if (client) {
    res.json(client);
  } else {
    res.status(404).json({ error: "Client not found" });
  }
});



app.listen(3000, () => console.log("Server running on port 3000"));