const functions = require('firebase-functions');
var admin = require("firebase-admin");
const algoliasearch = require('algoliasearch');

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