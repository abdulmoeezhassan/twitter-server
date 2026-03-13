const express = require("express");
const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

const app = express();
app.use(express.json());

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
      url: "https://api.x.com/2/tweets",
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

app.listen(3000, () => console.log("Server running on port 3000"));