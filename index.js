const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()


const app = express()
const port = process.env.PORT || 4000

