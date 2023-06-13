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
    // client.connect();



    const usersCollection = client.db("campNinja").collection("users");
    const classCollection = client.db("campNinja").collection("classes");
    const bookedClassesCollection = client.db("campNinja").collection("bookedClasses");
    const paymentsCollection = client.db("campNinja").collection("payments");
    const enrolledCollection = client.db("campNinja").collection("enrolled");
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

      // api for top 6 classes based on enrolled students using aggregate for better performances no need for jwt
      app.get('/popular-classes', async(req,res)=>{
        try {      
          const popularClasses = await classCollection.aggregate([
            { $match: { status: 'Approved' } },
            { $sort: { enrolled: -1 } },
            { $limit: 6 }
          ]).toArray();
      
          res.send(popularClasses);
        } catch (error) {
          res.status(500).send({ error:true, message: 'server error' });
        }
      })
      // api for filtering approved classes no need for jwt
      // app.get('/approved-classes', async(req, res) =>{
      //   try {      
      //     const approvedClasses = await classCollection.find({ status: 'Approved' }).toArray();
      //     res.send(approvedClasses);
      //   } catch (error) {
      //     res.status(500).send({ error: 'Server error' });
      //   }
      // })
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
      // class booking api for student
      app.post('/book-class',validateJWT, async(req,res)=> {
        const newBooking = req.body
        const result = await bookedClassesCollection.insertOne(newBooking)
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
      // student selected classes api
      app.get('/students-selected-classes', validateJWT, async(req, res) => {
        const email = req.query?.email;
        
        if(!email){
          return res.send([]);
        }
        const jwtDecodedEmail = req.decoded.email 
        if(email !== jwtDecodedEmail){
          return res.status(403).send({error: true, message: 'access --> forbidden'})
        }
        const query = { studentEmail : email};
        const result = await bookedClassesCollection.find(query).toArray();
        res.send(result)
      })
      // delete selected class api for student
      app.delete('/students-selected-classes', async(req,res) => {
        const id = req.query?.id;
        const query = { _id : new ObjectId(id) }
        const result = await bookedClassesCollection.deleteOne(query)
        res.send(result);
      })
      // get all instructors to display at instructors page no verification needed
      app.get('/instructors', async(req,res) => {
        const filter = { role : "instructor" }
        const result = await usersCollection.find(filter).toArray();
        res.send(result);
      })
      // get all classes to display that are approved at classes page no verification needed
      app.get('/approved-classes', async(req,res) => {
        const filter = { status : "Approved" }
        const result = await classCollection.find(filter).toArray();
        res.send(result);
      })

      // user role getting api 
      app.get('/user-role/:email', validateJWT, async(req,res)=>{
       
        try {

          const email  = req.params.email;
          const user = await usersCollection.findOne({ email });
          if (!user) {
            return res.status(404).send({ error: 'User not found' });
          }
          const role = user.role;
      
          res.send({ role });
        } catch (error) {
          res.status(500).send({ error: 'Server error' });
        }
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
      // api for student to view my enrolled classes
      // instructor classes api
      app.get('/student-enrolled-classes', validateJWT, async(req, res) => {
        const email = req.query?.email;
        
        if(!email){
          return res.send([]);
        }
        const jwtDecodedEmail = req.decoded.email 
        if(email !== jwtDecodedEmail){
          return res.status(403).send({error: true, message: 'access --> forbidden'})
        }
        const query = { studentEmail : email};
        const result = await enrolledCollection.find(query).toArray();
        res.send(result)
      })
      app.get('/payment-history', async(req,res)=>{
        try {
          const email = req.query?.email;
      
          const pipeline = [
            
            { $match: { email } },
            
            { $sort: { date: -1,price: -1 } }
          ];
      
          const payments = await paymentsCollection.aggregate(pipeline).toArray();
      
          res.send(payments);
        } catch (error) {
          
          res.status(500).send({ error: 'Server error' });
        }
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
    // create payment intent api
    app.post('/create-payment-intent', validateJWT, async (req, res) => {
      const  price  = req.body.price
      if (!price){
        return
      }
      const amount = parseFloat(price)*100
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      })

      res.send({ clientSecret: paymentIntent.client_secret})
    })
    // payment api
    app.post('/payments',validateJWT, async(req, res) => {
      const payment = req.body;
      // console.log(payment)
      const insertResult = await paymentsCollection.insertOne(payment)
      const query = { _id: new ObjectId(payment.bookedClassId)  }
      const deleteResult = await bookedClassesCollection.deleteOne(query)
      const filter = { _id: new ObjectId(payment.classId)};
        const classField = await classCollection.findOne(filter);
        // console.log(classField)
        const newEnrollment = { ...classField, student:payment.student, studentEmail: payment.studentEmail }
        const insertEnroll = await enrolledCollection.insertOne(newEnrollment)
        const findClass = { _id: new ObjectId(payment.classId) }
        const updatedClass = await classCollection.findOneAndUpdate(
          filter,
          { $inc: { enrolled: 1, availableSeats: -1 } },
          { returnOriginal: false }
        );
      res.send({insertResult, deleteResult,updatedClass,insertEnroll})
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

