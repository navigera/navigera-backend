const functions = require('firebase-functions');
var admin = require("firebase-admin");

// var serviceAccount = require("./env/ikea-mau-firebase-adminsdk-v92sd-d030f9b8db.json");

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: "https://ikea-mau.firebaseio.com"
// });

admin.initializeApp(functions.config().firebase);

let db = admin.firestore();

const express = require('express');
const app = express();

app.get('/getProduct/:id', async (req, res) => {
    let catalogue = db.collection('ikea_collection').doc('catalogue');

    let id = req.params.id;
    console.log("Looking for product with id: " + id);
    catalogue.listCollections().then(productFamilies => {
        productFamilies.forEach(productFamily => {
            let product = productFamily.doc(id);

            product.get()
                .then(doc => {
                    if (!doc.exists) {
                        console.log('No such document!');
                    } else {
                        let productData = doc.data();
                        productData.familyName = productFamily.id;
                        productData.id = product.id;
                        console.log('Found product:', doc.data());
                        res.json(productData);
                    }
                    return productData;
                }).catch(err => {
                    console.log('Error getting document', err);
                    return err;
                });
        });
        return productFamily;
    }).catch(error => {
        console.log(error);
        return error;
    });

});

app.get('/hello', (req, res) => {
    res.sendStatus(200);
})
exports.api = functions.https.onRequest(app);
