const express = require("express");
const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());


const GOOGLE_API_KEY = "AIzaSyBiq53-JT9R8TfcNnoUwkPBonfM4NxpQ4c";
const API_KEY = "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";
const BTC_BUCKETS_DATA_SOURCE_ID = "329b26a4-3077-808e-b870-000b9ddd1274";
const BTC_TASKS_DATA_SOURCE_ID = "312b26a4-3077-8071-b771-000b9f20bebf";
const LOCATION_ID = "gAefFGrUZxvnpxbtzDu2";
const GHL_API_KEY = "pit-a043fc50-feac-4666-8c62-d5ccdb87c767";


const PIPELINE_ID = "KmtTnj6BfnzRZXO0bdtP";
const STAGE_ID = "97b3a522-97c0-485a-8724-c33d0245a90e"; 

const STATUS_FIELD_ID = "iT2wP2gKNzT3s0V9kvAt";
const INSPECTOR_FIELD_ID = "RvXeUTxDBa2ExVt9kUhR";
const USED_FIELD_ID = "0ehWGset3zNbYOio3FM0";

//Twitter API routes

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

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

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
        dateObj: new Date(date.getFullYear(), date.getMonth(), 1),
        isCurrentMonth:
          date.getMonth() === currentMonth &&
          date.getFullYear() === currentYear
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
        isCurrentMonth: m.isCurrentMonth,
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



// GHL API routes

const headers = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
};

app.put("/assign-inspector/:opportunityId", async (req, res) => {
  const { opportunityId } = req.params;
  const { inspectorId, used } = req.body;

  try {
    // Update both opportunity and contact in parallel
    const [oppRes, contactRes] = await Promise.all([
      // Update Opportunity
      axios.put(
        `https://services.leadconnectorhq.com/opportunities/${opportunityId}`,
        {
          pipelineId: PIPELINE_ID,
          pipelineStageId: STAGE_ID,
          status: "open",
          customFields: [
            { id: STATUS_FIELD_ID, value: "assigned" },
            { id: INSPECTOR_FIELD_ID, value: inspectorId }
          ],
        },
        { headers }
      ),

      // Update Contact (Inspector)
      axios.put(
        `https://services.leadconnectorhq.com/contacts/${inspectorId}`,
        {
          customFields: [
            { id: USED_FIELD_ID, value: String(used) } // always string
          ]
        },
        { headers }
      )
    ]);

    // ✅ Return a single response
    return res.json({
      message: "Assignment successful",
      opportunity: oppRes.data,
      contact: contactRes.data
    });

  } catch (err) {
    console.error("Error assigning inspector:", err.response?.data || err.message);

    // ✅ Single error response
    return res.status(500).json({
      error: "Failed to assign inspector",
      details: err.response?.data || err.message
    });
  }
});

function getRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

function getRandomRadius() {
  return Math.floor(Math.random() * 21) + 50;
}

// ---------- Fetch Inspectors ----------
async function fetchInspectors() {
  try {
    const response = await axios.post(
      "https://services.leadconnectorhq.com/contacts/search",
      {
        locationId: LOCATION_ID,
        pageLimit: 100,
      },
      { headers }
    );

    const contacts = response.data.contacts || [];

    const inspectorPromises = contacts
      .filter((c) => {
        const inspectorField = c.customFields?.find(
          (f) => f.id === "JowqLT5Ufq8vnDmT47t8"
        );
        return inspectorField?.value === "true";
      })
      .map(async (c) => {
        const phoneField = c.customFields?.find(
          (f) => f.id === "gIC3EhawD7gzB9QOgOfj"
        );

        const addressField = c.customFields?.find(
          (f) => f.id === "wyoVE8uKgCfa8theCmJ9"
        );

        // 👇 NEW FIELDS
        const availableField = c.customFields?.find(
          (f) => f.id === "0ehWGset3zNbYOio3FM0"
        );

        const totalField = c.customFields?.find(
          (f) => f.id === "Qz3jdktda6mvol83pRI3"
        );

        const available = Number(availableField?.value || 0);
        const cap = Number(totalField?.value || 0);
        const used = available;

        // Convert tags to specs
        const specs = (c.tags || []).map(
          (tag) => tag.charAt(0).toUpperCase() + tag.slice(1)
        );

        const addr = addressField?.value || "";

        let lat = null,
          lng = null;
        if (addr) {
          try {
            const geo = await axios.get(
              "https://maps.googleapis.com/maps/api/geocode/json",
              { params: { address: addr, key: GOOGLE_API_KEY } }
            );
            const loc = geo.data.results[0]?.geometry.location;
            if (loc) {
              lat = loc.lat;
              lng = loc.lng;
            }
          } catch (err) {
            console.error(`Geocode failed for "${addr}":`, err.message);
          }
        }

        return {
          id: c.id,
          name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
          city: c.city || "",
          state: c.state || "",
          phone: phoneField?.value || c.phone || "",
          address: addr,
          specs,
          lat,
          lng,
          color: getRandomColor(),
          radius: getRandomRadius(),

          // 👇 NEW OUTPUT
          cap: cap,
          used: used,
        };
      });

    const inspectors = await Promise.all(inspectorPromises);
    return inspectors;
  } catch (error) {
    console.error(
      "Error fetching inspectors:",
      error.response?.data || error.message
    );
    return [];
  }
}

// ---------- Inspectors Endpoint ----------
app.get("/inspectors", async (req, res) => {
  try {
    const inspectors = await fetchInspectors();
    res.json({
      total: inspectors.length,
      inspectors,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inspectors" });
  }
});

async function fetchPipelines() {
  try {
    const response = await axios.get(
      `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${LOCATION_ID}`,
      { headers }
    );

    return response.data.pipelines || [];
  } catch (err) {
    console.error("Error fetching pipelines:", err.response?.data || err.message);
    return [];
  }
}

async function fetchOpportunities() {
  try {
    const response = await axios.post(
      'https://services.leadconnectorhq.com/opportunities/search',
      {
        locationId: LOCATION_ID,
        limit: 50,
        page: 1,
        additionalDetails: {
          notes: true,
          tasks: true,
          calendarEvents: true,
          unReadConversations: true
        }
      },
      { headers }
    );

    const opportunities = response.data.opportunities || [];

const mapped = await Promise.all(
  opportunities.map(async (opp) => {
    const fieldMap = {};
    opp.customFields?.forEach((field) => {
      fieldMap[field.id] = field.fieldValueString || "";
    });

    const addr = fieldMap["oziRydJu8nFxWbzXDjpu"] || "";
    const type = fieldMap["N1J3OE5a0lB971dnk0YJ"] || "";
    const firm = fieldMap["EKErA5rZ2PS7i5iG9lO3"] || "";
    const note = fieldMap["gbtrxDQNuRZZeGGYo9gT"] || "";
    const status = fieldMap["iT2wP2gKNzT3s0V9kvAt"] || "";
    const assignedTo = fieldMap["RvXeUTxDBa2ExVt9kUhR"] || null;
    const inspectionStatus = fieldMap["kWqaEbtFqXrWz4Z9yRJM"] || "";

    if (inspectionStatus.toLowerCase() === "pending") return null;

    let lat = null, lng = null;

    if (addr) {
      try {
        const geo = await axios.get(
          "https://maps.googleapis.com/maps/api/geocode/json",
          {
            params: { address: addr, key: GOOGLE_API_KEY },
          }
        );

        const loc = geo.data.results[0]?.geometry.location;
        if (loc) {
          lat = loc.lat;
          lng = loc.lng;
        }
      } catch (err) {
        console.error(`Geocode failed for "${addr}":`, err.message);
      }
    }

    return {
      id: opp.id,
      name: opp.name,
      addr,
      lat,
      lng,
      firm,
      type,
      status,
      assignedTo,
      inspectionStatus, // optional if you want to send
      date: opp.createdAt
        ? new Date(opp.createdAt).toISOString().split("T")[0]
        : "",
      note,
    };
  })
);

// ✅ Remove nulls (pending ones)
return mapped.filter(Boolean);
  } catch (err) {
    console.error("Error fetching opportunities:", err.response?.data || err.message);
    return [];
  }
}


app.get("/new-inspections", async (req, res) => {
  try {
    const inspections = await fetchOpportunities();
     res.json({ total: inspections.length, inspections: inspections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch inspections" });
  }
});


app.listen(3000, () => console.log("Server running on port 3000"));