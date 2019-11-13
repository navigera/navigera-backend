const functions = require('firebase-functions');
var admin = require("firebase-admin");
const algoliasearch = require('algoliasearch');
const storesJSON = `[{"name":"Stockholm Kungens Kurva","no":"012","lat":59.271155,"long":17.916201},{"name":"Göteborg Kållered","no":"014","lat":57.60379,"long":12.048397},{"name":"Linköping","no":"017","lat":58.433189,"long":15.58755},{"name":"Stockholm Barkarby","no":"019","lat":59.420331,"long":17.857064},{"name":"Västerås","no":"020","lat":59.607596,"long":16.456017},{"name":"Uddevalla","no":"053","lat":58.355878,"long":11.818371},{"name":"Uppsala","no":"070","lat":59.847755,"long":17.692156},{"name":"Örebro","no":"106","lat":59.211089,"long":15.134397},{"name":"Jönköping","no":"109","lat":57.77267,"long":14.205751},{"name":"Gävle","no":"122","lat":60.633906,"long":16.989895},{"name":"Borlänge","no":"248","lat":60.482664,"long":15.421457},{"name":"Älmhult","no":"268","lat":56.550534,"long":14.161674},{"name":"Göteborg Bäckebol","no":"398","lat":57.771771,"long":11.999672},{"name":"Umeå","no":"416","lat":63.80771,"long":20.25501},{"name":"Malmö","no":"445","lat":55.552634,"long":12.986215},{"name":"Sundsvall","no":"467","lat":62.444195,"long":17.334119},{"name":"Helsingborg","no":"468","lat":56.092426,"long":12.760899},{"name":"Kalmar","no":"469","lat":56.68556,"long":16.321199},{"name":"Haparanda Tornio","no":"470","lat":65.842982,"long":24.13192},{"name":"Karlstad","no":"471","lat":59.378797,"long":13.41966}]`;

const APP_ID = functions.config().algolia.app;
const ADMIN_KEY = functions.config().algolia.key;

const client = algoliasearch(APP_ID, ADMIN_KEY);
const index = client.initIndex('dev_products');

// var serviceAccount = require("./env/ikea-mau-eu-firebase-adminsdk-74vd1-1752f561a6.json");

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: "https://ikea-mau-eu.firebaseio.com"
// });

admin.initializeApp(functions.config().firebase);

let db = admin.firestore();

const express = require('express');
const app = express();

const products = db.collection('ikea_products');

app.get('/getStores', (req, res) => {
    let json = JSON.parse(storesJSON);
    res.json(json);
});

app.get('/getProduct/:id', async (req, res) => {
    let promises = [];
    let ids = req.params.id.split(',');

    if (ids.length > 1) {
        ids.forEach((id) => {
            promises.push(getProduct(id));
        });

        Promise.all(promises).then((data) => {
            res.json({ products: data });
            return data;
        }).catch((error) => {
            res.json(error);
            return error;
        });
    } else {
        let data = await getProduct(ids[0]);
        res.json({ product: data });
    }
});

app.get('/search/:query', async (req, res) => {
    index.search(
        {
            query: req.params.query,
            attributesToRetrieve: ['id'],
            hitsPerPage: 50,
        },
        (err, { hits } = {}) => {
            if (err) throw err;

            let promises = [];
            hits.forEach(async (hit) => {
                promises.push(getProduct(hit.id));
            });

            Promise.all(promises).then((results) => {
                res.json(results);
                return results;
            }).catch(error => {
                res.send(error);
                return error;
            })
        }
    );
});

async function getProduct(id) {
    let product = await products.doc(id).get();

    if (product.exists) {
        let productData = product.data();
        return productData;
    } else {
        return { error: "Couldn't find product." }
    }
}



app.get('/', (req, res) => {
    res.json("These are not the droids you're looking for.");
});



exports.api = functions.region('europe-west2').https.onRequest(app);

// Create a HTTP request cloud function.
exports.sendCollectionToAlgolia = functions.https.onRequest(async (req, res) => {

    var algoliaRecords = [];

    const querySnapshot = await products.listDocuments();

    let promises = [];

    querySnapshot.forEach(async (doc) => {
        promises.push(doc.get());
    });

    Promise.all(promises).then(docs => {

        docs.forEach((doc) => {
            const data = doc.data();

            const record = {
                objectID: data.product_info.id,
                category: data.product_info.category,
                family: data.product_info.family,
                id: data.product_info.id,
                color: data.product_info.color
            };

            algoliaRecords.push(record);
            return record;
        });

        index.saveObjects(algoliaRecords, (error, content) => {
            res.status(200).send("Products was indexed to Algolia successfully.");
        });

        return docs;
    }).catch((error) => {
        res.send(error);
        return error;
    });
});

exports.collectionOnCreate = functions.firestore.document('ikea_products/{uid}').onCreate(async (snapshot, context) => {
    await saveDocumentInAlgolia(snapshot);
});

exports.collectionOnUpdate = functions.firestore.document('ikea_products/{uid}').onUpdate(async (change, context) => {
    await updateDocumentInAlgolia(change);
});

exports.collectionOnDelete = functions.firestore.document('ikea_products/{uid}').onDelete(async (snapshot, context) => {
    await deleteDocumentFromAlgolia(snapshot);
});

async function saveDocumentInAlgolia(snapshot) {
    if (snapshot.exists) {
        const record = snapshot.data();
        if (record) {
            if (record.isIncomplete === false) {
                record.objectID = snapshot.id;

                await index.saveObject(record);
            }
        }
    }
}

async function updateDocumentInAlgolia(change) {
    const docBeforeChange = change.before.data()
    const docAfterChange = change.after.data()
    if (docBeforeChange && docAfterChange) {
        if (docAfterChange.isIncomplete && !docBeforeChange.isIncomplete) {
            await deleteDocumentFromAlgolia(change.after);
        } else if (docAfterChange.isIncomplete === false) {
            await saveDocumentInAlgolia(change.after);
        }
    }
}

async function deleteDocumentFromAlgolia(snapshot) {
    if (snapshot.exists) {
        const objectID = snapshot.id;
        await index.deleteObject(objectID);
    }
}