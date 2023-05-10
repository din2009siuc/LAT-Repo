'use strict';

const 	express = require('express'),
		configGet = require('config'),
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
	const results = await analyticsClient.analyzeSentiment(document);
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
		const r = res[0].sentiment;
		const msg = {
			type: 'text',
			text: sentiments_trans[r] + "。分數：" + res[0].confidenceScores[r]
		};
		return client.replyMessage(event.replyToken, msg);
	})
	.catch((err) => {
		console.error("Error:", err);
	})
}
