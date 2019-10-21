const functions = require('firebase-functions');
var admin = require("firebase-admin");

var serviceAccount = require("./env/ikea-mau-eu-firebase-adminsdk-74vd1-1752f561a6.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ikea-mau-eu.firebaseio.com"
});

//admin.initializeApp(functions.config().firebase);

let db = admin.firestore();

const express = require('express');
const app = express();

const products = db.collection('ikea_products');

app.get('/getProduct/:id', async (req, res) => {
    let promises = [];
    let ids = req.params.id.split(',');

    if(ids.length > 1){
        ids.forEach((id) => {
            promises.push(getProduct(id));
        });
    
        Promise.all(promises).then((data) => {
            res.json({products: data});
            return data;
        }).catch((error) => {
            console.log(error);
            return error;
        });
    }else{
        let data = await getProduct(ids[0]);
        res.json({product: data});
    }
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
    res.send("These are not the droids you're looking for.");
})
exports.api = functions.https.onRequest(app);