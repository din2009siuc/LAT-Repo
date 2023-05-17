'use strict';

const 	express = require('express'),
		configGet = require('config'),
		axios = require('axios'),
		line = require('@line/bot-sdk'),
		path = require('path'),
		stream = require('stream'),
		fs = require('fs')
const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");

const configLine = {
	channelAccessToken: configGet.get("CHANNEL_ACCESS_TOKEN"),
	channelSecret: configGet.get("CHANNEL_SECRET")
};

const endpoint = configGet.get("ENDPOINT");
const apiKey = configGet.get("TEXT_ANALYTICS_API_KEY");

const client = new line.Client(configLine); const app = express();

const port = process.env.PORT || process.env.port || 3000;
app.listen (port, () => {
		console.log(`listening on ${port}`);
	}
);

async function MS_TextSentimentAnalysis(event) {
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
	if ( event.type  === 'unsend' ) {
		client.replyMessage(event.replyToken, {type:'text', text: "來不及囉"});
		client.replyMessage(event.replyToken, {type:'text', text: "哈"});
		return Promise.resolve(null);
	}
	if ( event.type !== 'message' ) return Promise.resolve(null);

	if ( event.message.type === 'text' ) {
		return handleText(event);
	} else if ( event.message.type === 'image' ) {
		return handleImage(event);
	}

	return Promise.resolve(null);
}

function handleText(event) {
	MS_TextSentimentAnalysis(event)
	.then((res) => {
		console.log(JSON.stringify(res[0]));
		const sentiment = res[0].sentiment;
		// Save to JSON server
		/*
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
			// console.log(JSON.stringify(response.data));
		})
		.catch ( (err) => {
			console.error(err);
		})
		*/
		let replyText;
		const opinions = res[0].sentences[0].opinions;
		if ( opinions.length>0 ) {
			if ( sentiment==='negative' ) {
				replyText = "對不起，我們會改進";
				for ( let i=0; i<opinions.length; i++ ) {
					replyText += opinions[i].target.text + (i!==opinions.length-1?'、':'。');
				}
			} else {
				replyText = "謝謝你對"; 
				for ( let i=0; i<opinions.length; i++ ) {
					replyText += opinions[i].target.text + (i!==opinions.length-1?'、':'');
				}
				replyText += "的回饋。";
			}
		} else {
			replyText = sentiments_trans[sentiment] + "。\n分數：" + res[0].confidenceScores[sentiment];
		}
		const msg = {
			type: 'text',
			text: replyText
		};
		return client.replyMessage(event.replyToken, msg);
	})
	.catch((err) => {
		console.error("Error:", err);
	})
}

function downloadContent(messageId, downloadPath) {
	return client.getMessageContent(messageId)
	.then((stream) => new Promise((resolve, reject) => {
		const writable = fs.createWriteStream(downloadPath);
		stream.pipe(writable);
		stream.on('end', () => resolve(downloadPath));
		stream.on('error', reject);
	}));
}

function handleImage(event) {
	client.replyMessage(event.replyToken, {type:'text', text: "真好看"});

	const message = event.message
	let getContent;
	if (message.contentProvider.type === "line") {
		const downloadPath = path.join(process.cwd(), 'downloaded', `${message.id}.jpg`);

		getContent = downloadContent(message.id, downloadPath)
		.then((downloadPath) => {
			return {
				originalContentUrl: baseURL + '/downloaded/' + path.basename(downloadPath),
				previewImageUrl: baseURL + '/downloaded/' + path.basename(downloadPath),
			};
		});

	} else if (message.contentProvider.type === "external") {
		getContent = Promise.resolve(message.contentProvider);

	}

	return getContent
	.then(({ originalContentUrl, previewImageUrl }) => {
		const msg = {
			type: 'image',
			originalContentUrl,
			previewImageUrl,
		}
		return client.replyMessage(replyToken, msg);
		// client.replyMessage(event.replyToken, {type:'text', text: "真好看"});
	});	
}
