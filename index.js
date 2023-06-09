const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()

const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

const { MongoClient, ServerApiVersion } = require('mongodb');


const app = express()
const port = process.env.PORT || 4000



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5j7d2x6.mongodb.net/?retryWrites=true&w=majority`;
// const uri = "mongodb+srv://<username>:<password>@cluster0.5j7d2x6.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const validateJWT = async(req,res,next) =>{
    const authorization = req.headers.authorization;
    if(!authorization){
      return res.status(401).send({error: true, message: 'You are not authorized'})
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
      if(error){
        return res.status(401).send({error: true, message: 'You are not authorized'})
      }
      
      req.decoded = decoded;
      next() 
    })
  }

  

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    client.connect();



    const usersCollection = client.db("campNinja").collection("users");

    const adminVerifier = async(req, res, next) => {
        const email = req.decoded.email
        const query = { email : email}
        const user = await usersCollection.findOne(query)
        if(user?.role !== 'admin'){
          return res.status(403).send({error: true , message: 'You are not authorized to access this'})
        }
        next()
      }

     // jwt token sender api

     app.post('/jwt', (req, res) =>{
        const requester = req.body;

        const token = jwt.sign(requester, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '2h'
        })

        res.send({ token });
      })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req,res)=>{
    res.send('Camp ninja is operating')
})
app.listen(port,() => {
    console.log(`Camp ninja is operating on port ${port}`)
})

