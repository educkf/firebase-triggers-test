const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');

admin.initializeApp();
const database = admin.firestore();

const projectId = 'triggers-test-project';

const pubSubClient = new PubSub({
    projectId
});  

exports.processQueue = functions
    .firestore
    .document('Queue/{queueId}')
    .onCreate(async (snap, context) => {
      
        const newValue = snap.data();
        const toSave = { ...newValue, ...context };
    
        if (newValue.type === "INVOICE") {
            try {
                const [topics] = await pubSubClient.getTopics();
                const hasINVOICE = topics.filter(topic => topic.name === `projects/${projectId}/topics/INVOICE`);

                if (hasINVOICE.length === 0) 
                    await pubSubClient.createTopic("INVOICE");
                
                const dataBuffer = Buffer.from(JSON.stringify(toSave));

                await pubSubClient.topic('INVOICE').publish(dataBuffer);
                return true;

            } catch(err) {
                console.log("\n\n");
                console.log("index.js processQueue: ");
                console.log(err);
                return false;
            }
        }

        return true;
    });

exports.emitInvoice = functions
    .pubsub
    .topic('INVOICE')
    .onPublish(async (message) => {
        try {
            await database.collection('/Invoices').add({
                date: new Date(),
                message: message.data ? Buffer.from(message.data, 'base64').toString() : JSON.stringify(message)
            });
            return true;

        } catch(err) {  
            console.log("\n\n");
            console.log("index.js emitInvoice: ");
            console.log(err);
            return false;
        }
    });