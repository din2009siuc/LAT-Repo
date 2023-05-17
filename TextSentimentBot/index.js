'use strict';

const 	express = require('express'),
		configGet = require('config'),
		axios = require('axios'),
		line = require('@line/bot-sdk');
const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");

const configLine = {
	channelAccessToken: configGet.get("CHANNEL_ACCESS_TOKEN"),
	channelSecret: configGet.get("CHANNEL_SECRET")
};

const endpoint = configGet.get("ENDPOINT");
const apiKey = configGet.get("TEXT_ANALYTICS_API_KEY");

const client = new line.Client(configLine);
const app = express();

const port = process.env.PORT || process.env.port || 3000;
app.listen (port, () => {
		console.log(`listening on ${port}`);
	}
);

async function MS_TextSentimentAnalysis(event) {
	// console.log("[MS_TextSentimentAnalysis] in");
	const analyticsClient = new TextAnalyticsClient(endpoint, new AzureKeyCredential(apiKey));
	let document = [];
	document.push(event.message.text);
	const results = await analyticsClient.analyzeSentiment(document, 'zh-Hant', {includeOpinionMining:true});
	return results;
}

app.post('/callback', line.middleware(configLine), (req, res) => {
	Promise
		.all(req.body.events.map(handleEvent))
		.then((result)=>res.json(result))
		.catch((err)=>{
			console.error(err);
			res.status(500).end();
		});
});

const sentiments_trans = {"neutral":"中性", "positive":"正向", "negative":"負向"};

function handleEvent(event) {
	if ( event.type !== 'message' || event.message.type !== 'text' ) {
		return Promise.resolve(null);
	}

	MS_TextSentimentAnalysis(event)
	.then((res) => {
		const sentiment = res[0].sentiment;
		// Save to JSON server
		const newData = {
			"sentiment": sentiment,
			"confidenceScore": res[0].confidenceScores[sentiment]
		}
		const axios_req = {
			method: "post",
			url: "https://apppppp-name-2365.azurewebsites.net/reviews",
			headers: {
				"content-type": "application/json"
			},
			data: newData
		}

		axios(axios_req)
		.then ( (response) => {
			console.log(JSON.stringify(response.data));
		})
		.catch ( (err) => {
			console.error(err);
		})

		const msg = {
			type: 'text',
			text: sentiments_trans[sentiment] + "。分數：" + res[0].confidenceScores[sentiment]
		};
		return client.replyMessage(event.replyToken, msg);
	})
	.catch((err) => {
		console.error("Error:", err);
	})
}
