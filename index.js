const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()

const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

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

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY, (error, decoded) => {
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
    const classCollection = client.db("campNinja").collection("classes");
    const adminVerifier = async(req, res, next) => {
        const email = req.decoded.email
        const query = { email : email}
        const user = await usersCollection.findOne(query)
        if(user?.role !== 'admin'){
          return res.status(403).send({error: true , message: 'You are not authorized to access this'})
        }
        next()
      }

    const instructorVerifier = async(req, res, next) => {
        const email = req.decoded.email
        const query = { email : email}
        const user = await usersCollection.findOne(query)
        if(user?.role !== 'instructor'){
          return res.status(403).send({error: true , message: 'You are not authorized to access this'})
        }
        next()
      }

     // jwt token sender api

     app.post('/jwt', (req, res) =>{
        const requester = req.body;

        const token = jwt.sign(requester, process.env.ACCESS_TOKEN_SECRET_KEY, {
          expiresIn: '2h'
        })
        // console.log("delivered")
        res.send({ token });
      })
      // registering first time user to student
      app.post('/register-new-user',async(req, res) => {
        const requester = req.body
        const query = { email: requester.email }
        const alreadyRegistered = await usersCollection.findOne(query)
        if(alreadyRegistered){
          return res.send({ message: 'You are already registered' })
        }
        const result = await usersCollection.insertOne(requester);
        res.send(result);
      })
      // class adding api for instructor
      app.post('/add-class',validateJWT, async(req,res)=> {
        const newClass = req.body
        const result = await classCollection.insertOne(newClass)
        res.send(result)
      })
      // instructor classes api
      app.get('/instructor-classes', validateJWT, async(req, res) => {
        const email = req.query?.email;
        
        if(!email){
          return res.send([]);
        }
        const jwtDecodedEmail = req.decoded.email 
        if(email !== jwtDecodedEmail){
          return res.status(403).send({error: true, message: 'access --> forbidden'})
        }
        const query = { instructorEmail : email};
        const result = await classCollection.find(query).toArray();
        res.send(result)
      })
      // get all instructors to display at instructors page no verification needed
      app.get('/instructors', async(req,res) => {
        const filter = { role : "instructor" }
        const result = await usersCollection.find(filter).toArray();
        res.send(result);
      })

      // getting all users to display at admin-dashboard manage users page
      app.get('/users',validateJWT, async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      })

      // getting all the classes to display at admin  
      app.get('/classes',validateJWT, async (req, res) => {
        const result = await classCollection.find().toArray();
        res.send(result);
      })
      // api for admin to make the user an admin
      app.patch('/users/make-admin/:userId',validateJWT, async(req, res) => {
        const userId = req.params.userId;
        const filter = { _id: new ObjectId(userId) }
        const updateRole = {
          $set: {
            role : 'admin'
          }
        }
        const result = await usersCollection.updateOne(filter, updateRole);
        res.send(result);
      })
      // api for admin to make the user an instructor
      app.patch('/users/make-instructor/:userId',validateJWT, async(req, res) => {
        const userId = req.params.userId;
        const filter = { _id: new ObjectId(userId) }
        const updateRole = {
          $set: {
            role : 'instructor'
          }
        }
        const result = await usersCollection.updateOne(filter, updateRole);
        res.send(result);
      })
      // api for admin to approve class
      app.patch('/classes/approve-class/:classId',validateJWT, async(req, res) => {
        const classId = req.params.classId;
        // console.log(classId)
        const filter = { _id: new ObjectId(classId) }
        const updateStatus = {
          $set: {
            status : 'Approved'
          }
        }
        const result = await classCollection.updateOne(filter, updateStatus);
        res.send(result);
      })
      // api for admin to deny class
      app.patch('/classes/deny-class/:classId',validateJWT, async(req, res) => {
        const classId = req.params.classId;
        const filter = { _id: new ObjectId(classId) }
        const updateStatus = {
          $set: {
            status : 'Denied'
          }
        }
        const result = await classCollection.updateOne(filter, updateStatus);
        res.send(result);
      })
      // api for admin to give feedback class
      app.patch('/classes/class-feedback/:classId',validateJWT, async(req, res) => {
        const classId = req.params.classId;
        const classFeedback = req.body
        // console.log(classId,classFeedback)
        const filter = { _id: new ObjectId(classId) }
        const updateStatus = {
          $set: {
            feedback : classFeedback.feedback
          }
        }
        const result = await classCollection.updateOne(filter, updateStatus);
        res.send(result);
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

