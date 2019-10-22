# NAVIGERA BACKEND

For getting details about the furniture.

## Endpoints:

```/getProduct/<PRODUCT_ID>```

Fetches details about a single product, [sample JSON response here](https://pastebin.com/d0NmuxBF).


```/getProduct/<PRODUCT_ID>,<PRODUCT_ID>,<PRODUCT_ID>...```

Fetches details about multiple products, [sample JSON response here](https://pastebin.com/vPnSaJgX).

```/search/<QUERY>```

Uses Algolia to search through the product collection, and returns a list of products matching the query.
[Sample response on the query 'Bill'.](https://pastebin.com/4jSWBQWz)
