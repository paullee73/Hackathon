'use strict';

/*
TODO

Implement a long press function that alerts the parent of an emergency.
Implement text messsage instead of email

*/

const https = require('https');
const AWS = require('aws-sdk');

const EMAIL = 'paulleechat3@gmail.com';  // TODO change me
const SNS = new AWS.SNS({ apiVersion: '2010-03-31' });


function findExistingSubscription(topicArn, nextToken, cb) {
    const params = {
        TopicArn: topicArn,
        NextToken: nextToken || null,
    };
    SNS.listSubscriptionsByTopic(params, (err, data) => {
        if (err) {
            console.log('Error listing subscriptions.', err);
            return cb(err);
        }
        const subscription = data.Subscriptions.filter((sub) => sub.Protocol === 'email' && sub.Endpoint === EMAIL)[0];
        if (!subscription) {
            if (!data.NextToken) {
                cb(null, null); // indicate that no subscription was found
            } else {
                findExistingSubscription(topicArn, data.NextToken, cb); // iterate over next token
            }
        } else {
            cb(null, subscription); // a subscription was found
        }
    });
}

/**
 * Subscribe the specified EMAIL to a topic.
 */
function createSubscription(topicArn, cb) {
    // check to see if a subscription already exists
    findExistingSubscription(topicArn, null, (err, res) => {
        if (err) {
            console.log('Error finding existing subscription.', err);
            return cb(err);
        }
        if (!res) {
            // no subscription, create one
            const params = {
                Protocol: 'email',
                TopicArn: topicArn,
                Endpoint: EMAIL,
            };
            SNS.subscribe(params, (subscribeErr) => {
                if (subscribeErr) {
                    console.log('Error setting up email subscription.', subscribeErr);
                    return cb(subscribeErr);
                }
                // subscription complete
                console.log(`Subscribed ${EMAIL} to ${topicArn}.`);
                cb(null, topicArn);
            });
        } else {
            // subscription already exists, continue
            cb(null, topicArn);
        }
    });
}


function getMinutes(callback){
    var returnString = 'error';
    const req = https.request("https://api.wmata.com/NextBusService.svc/json/jPredictions?api_key=6b700f7ea9db408e9745c207da7ca827&StopID=1001195", (res) => {
        let body = '';
        console.log('Status:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log('Successfully processed HTTPS response');

               body = JSON.parse(body);
               console.log(body);
               body = body.Predictions;
               console.log(body.length);
				for (var i = 0; i < body.length; i++) {
				        var item = body[i];
				        console.log(item);
                        item = item.Minutes;
						returnString = returnString + " " + item;
						
			}
			    return returnString;


//}
            
            //callback(null, body);
        });
    });
    req.on('error', callback);
    req.end();


}

/**
 * Create a topic.
 */
function createTopic(topicName, cb) {
    SNS.createTopic({ Name: topicName }, (err, data) => {
        if (err) {
            console.log('Creating topic failed.', err);
            return cb(err);
        }
        const topicArn = data.TopicArn;
        console.log(`Created topic: ${topicArn}`);
        console.log('Creating subscriptions.');
        createSubscription(topicArn, (subscribeErr) => {
            if (subscribeErr) {
                return cb(subscribeErr);
            }
            // everything is good
            console.log('Topic setup complete.');
            cb(null, topicArn);
        });
    });
}



exports.handler = (event, context, callback) => {
    console.log('Received event:', event.clickType);
    var minutes = getMinutes(callback);
    console.log(minutes);
    // create/get topic
    createTopic('aws-iot-button-sns-topic', (err, topicArn) => {
        if (err) {
            return callback(err);
        }
        console.log(`Publishing to topic ${topicArn}`);
        // publish message
        const params = {
            //Message: '$(event['name'] has boarded the bus at stop $(GetBusStop()). They will be arriving home in $(GetMinutes()).
            Message: `Noah Kim has boarded the bus at stop Herndon Monroe Station. They will be arriving home in 5 minutes! The button has ${event.batteryVoltage} remaining.`,
            Subject: `Your child has gotten on the bus!`,
            TopicArn: topicArn,
            
        };
        // result will go to function callback
        SNS.publish(params, callback);
    });
};
