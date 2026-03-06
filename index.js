const express = require("express");
const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

const app = express();
app.use(express.json());

app.post("/tweet", async (req, res) => {
  const {
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
    text
  } = req.body;

  const oauth = OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: "HMAC-SHA1",
    hash_function(base_string, key) {
      return crypto
        .createHmac("sha1", key)
        .update(base_string)
        .digest("base64");
    }
  });

  const token = {
    key: accessToken,
    secret: accessTokenSecret
  };

  const requestData = {
    url: "https://api.twitter.com/2/tweets",
    method: "POST"
  };

  const headers = oauth.toHeader(oauth.authorize(requestData, token));

  try {
    const response = await axios.post(
      requestData.url,
      { text },
      {
        headers: {
          ...headers,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || err.message);
  }
});

app.listen(3000, () => console.log("Server running"));