const express = require("express");
const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

const app = express();
app.use(express.json());

app.post("/tweet", async (req, res) => {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret, text } = req.body;

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

    const response = await axios.post(
      requestData.url,
      { text },
      {
        headers: {
          Authorization: authHeader["Authorization"],
          "Content-Type": "application/json",
          "User-Agent": "MyTwitterApp/1.0",
        },
      }
    );

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

app.listen(3000, () => console.log("Server running on port 3000"));