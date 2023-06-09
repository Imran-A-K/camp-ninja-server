const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);


const app = express()
const port = process.env.PORT || 4000


app.get('/', (req,res)=>{
    res.send('Camp ninja is operating')
})
app.listen(port,() => {
    console.log(`Camp ninja is operating on port ${port}`)
})

